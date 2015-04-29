'use strict';

var redis = require('redis');
var appBroker = require('./appBroker');
var userDailyAggregation = require('./userDailyAggregation');
var MongoClient = require('mongodb').MongoClient;
var winston = require('winston');
var url = require('url');
var _ = require('lodash');

winston.add(winston.transports.File, { filename: 'userbroker.log', level: 'debug', json: false, prettyPrint: true });

winston.level = 'info';

winston.info('starting...');	
winston.error("Errors will be logged here");
winston.warn("Warns will be logged here");
winston.info("Info will be logged here");
winston.debug("Debug will be logged here");

var logger = winston;

process.on('uncaughtException', function(err) {
  winston.error('Caught exception: ' + err);
  throw err;
});

var redisSubscribe = redis.createClient();
redisSubscribe.subscribe('events');
redisSubscribe.subscribe('users');
redisSubscribe.subscribe('userbroker');

var mongoUrl = process.env.DBURI || 'mongodb://localhost/quantifieddev';
logger.info('using ' + url.parse(mongoUrl).host);

var users = {};
var repos = {
	user: {},
	userRollupByDay: {}
};

var streamsToUsers = {};

var setModuleLogger = function(module){
	module.setLogger(logger);
};

var eventModules = [];
eventModules.push(appBroker);
eventModules.push(userDailyAggregation);
_.map(eventModules, setModuleLogger);

var setLogger = function(l){
	logger = l;
	_.map(eventModules, setModuleLogger);
};

var cacheUser = function(user){
	users[user.username] = user;
	_.map(user.streams, function(stream){
		logger.info('mapping ' + stream.streamid + ' to ' + user.username);
		streamsToUsers[stream.streamid] = user;
	});
	logger.debug('mapped ' + user.username + ' streams');
};

// eas: on any user event we reload the whole user
var processUserEvent = function(userEvent, userRepository){
	logger.info('loading user into cache', userEvent.username);
	var condition = {
		username: userEvent.username
	};

	userRepository.findOne(condition, function(error, user){
		if(error){
			logger.error('error while retrieving user', error);
			return;
		}

		cacheUser(user);

		logger.debug('loaded user from database:', user);
	});
	
	logger.info('processed a user event', userEvent);
};

var cronDaily = function(module){
	module.cronDaily(users);
};

var cronDaily = function(module){
	module.cronDaily();
};

var subscribeMessage = function(channel, message){
	logger.debug(message);
	if(channel === 'events'){
		var event = JSON.parse(message);
		var userForStream = streamsToUsers[event.streamid];
		if(userForStream === undefined){
			logger.debug('stream doesnt have a user', event.streamid);
			logger.debug(streamsToUsers);
			return;
		}	

		for (var i = 0; i < eventModules.length; i++) {
			logger.silly('calling process event');
			eventModules[i].processEvent(event, userForStream, repos);
		}
	}
	else if(channel === 'users'){
		logger.debug('passing message to user processor');
		var userMessage = JSON.parse(message);
		processUserEvent(userMessage, users);
	}
	else if(channel === 'userbroker'){
		if(message === 'cron/daily'){
			logger.info('asking processor to send users events to apps');
			_.forEach(eventModules, cronDaily);
		} 
		else if(message.substring(0,7) === 'logging'){
			logger.level = message.split('=')[1];
			logger[logger.level]('logging level set to ' + logger.level);
		}
	}
	else{
		logger.info('unknown event type');
	}
};

var loadUsers = function(userRepository, callback){
	logger.info('loading users');
	userRepository.find().toArray(function(error, docs){
		logger.debug('database call complete');
	
		if(error){
			logger.error('error while retrieving all users');
			return;
		}

		logger.info('loaded ' + docs.length + ' users from the database');
		_.map(docs, function(user){
			cacheUser(user);
		});

		callback();	
	});
};

MongoClient.connect(mongoUrl, function(err, db) {	

	logger.info('connected to db');
	if(err){
		console.log(err);
	}

	repos.user = db.collection('users');
	repos.userRollupByDay = db.collection('userRollupByDay');
	loadUsers(repos.user, function(){
		redisSubscribe.on('message', subscribeMessage);
	});
});


// Expose app
//exports = module.exports = app;

module.exports = {};
module.exports.subscribeMessage = subscribeMessage;
module.exports.loadUsers = loadUsers;
module.exports.setLogger = setLogger;

