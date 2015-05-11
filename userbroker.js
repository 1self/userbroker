'use strict';

var appBroker = require('./appBroker');
var userDailyAggregation = require('./userDailyAggregation');
var winston = require('winston');
var _ = require('lodash');

winston.add(winston.transports.File, { filename: 'userbroker.log', level: 'debug', json: false, prettyPrint: true });

winston.level = 'info';

winston.info('starting...');	
winston.error("Errors will be logged here");
winston.warn("Warns will be logged here");
winston.info("Info will be logged here");
winston.debug("Debug will be logged here");



process.on('uncaughtException', function(err) {
  winston.error('Caught exception: ' + err);
  throw err;
});

var users = {};
var repos = {
	user: {},
	userRollupByDay: {}
};

var streamsToUsers = {};

var eventModules = [];
eventModules.push(appBroker);
eventModules.push(userDailyAggregation);

var logger = {};

var setLogger = function(l){
	logger = {
		info: function(key, message, data){
			l.info('userbroker: ' + key + ': ' + message, data);
		},
		verbose: function(key, message, data){
			l.verbose('userbroker: ' + key + ': ' + message, data);
		},
		error: function(key, message, data){
			l.error('userbroker: ' + key + ': ' + message, data);
		},
		debug: function(key, message, data){
			l.debug('userbroker: ' + key + ': ' + message, data);
		},
		silly: function(key, message, data){
			l.silly('userbroker: ' + key + ': ' + message, data);
		}
	};

	_.map(eventModules, function(module){
		module.setLogger(l);
	});
};

setLogger(winston);

var cacheUser = function(user){
	users[user.username] = user;
	_.map(user.streams, function(stream){
		logger.debug(user.username, 'mapping ' + stream.streamid + ' to ' + user.username);
		streamsToUsers[stream.streamid] = user;
	});
	logger.info(user.username, 'mapped ' + user.username + ' streams');
};

// eas: on any user event we reload the whole user
var processUserEvent = function(userEvent, userRepository){
	logger.info(userEvent.username, 'loading user into cache', userEvent.username);
	var condition = {
		username: userEvent.username
	};

	userRepository.findOne(condition, function(error, user){
		if(error){
			logger.error(userEvent.username, 'error while retrieving user', error);
			return;
		}

		cacheUser(user);

		logger.debug(userEvent.username, 'loaded user from database:', user);
	});
	
	logger.info(userEvent.username, 'processed a user event', userEvent);
};

var cronDaily = function(module){
	module.cronDaily(users);
};

var cronDaily = function(module){
	module.cronDaily();
};

var subscribeMessage = function(channel, message){
	logger.debug(channel, message);
	if(channel === 'events'){
		var event = JSON.parse(message);
		var userForStream = streamsToUsers[event.streamid];
		if(userForStream === undefined){
			logger.debug(event.streamid, 'stream doesnt have a user: event, event.streamsToUsers', [event, event.streamsToUsers]);
			return;
		}	

		for (var i = 0; i < eventModules.length; i++) {
			logger.silly(event.streamid, 'calling process event');
			eventModules[i].processEvent(event, userForStream, repos);
		}
	}
	else if(channel === 'users'){
		var userMessage = JSON.parse(message);
		processUserEvent(userMessage, repos.user);
	}
	else if(channel === 'userbroker'){
		if(message === 'cron/daily'){
			logger.info(channel, 'asking processor to send users events to apps');
			_.forEach(eventModules, cronDaily);
		} 
		else if(message.substring(0,7) === 'logging'){
			logger.level = message.split('=')[1];
			logger[logger.level](channel, 'logging level set to ' + logger.level);
		}
	}
	else{
		logger.info(channel, 'unknown event type');
	}
};

var loadUsers = function(userRepository, callback){
	logger.info('loading users', 'start');
	userRepository.find().toArray(function(error, docs){
		logger.debug('loading users', 'database call complete');
	
		if(error){
			logger.error('loading users', 'error while retrieving all users');
			return;
		}

		logger.info('loading users', 'loaded ' + docs.length + ' users from the database');
		_.map(docs, function(user){
			cacheUser(user);
		});

		callback();	
	});
};

var setUserRepo = function(userRepo){
	repos.user = userRepo;
};

var setUserRollupRepo = function(userRollupRepo){
	repos.userRollupByDay = userRollupRepo;
};

module.exports = {};
module.exports.subscribeMessage = subscribeMessage;
module.exports.loadUsers = loadUsers;
module.exports.setLogger = setLogger;
module.exports.setUserRepo = setUserRepo;
module.exports.setUserRollupRepo = setUserRollupRepo;
