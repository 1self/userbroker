'use strict';

var appBroker = require('./appBroker');
var userDailyAggregation = require('./userDailyAggregation');
var winston = require('winston');
var _ = require('lodash');
var path = require('path');
var assert = require('assert');

winston.level = 'info';
winston.info('LOGGINGDIR: ' + process.env.LOGGINGDIR);
assert(process.env.LOGGINGDIR !== undefined);
var loggingLocation = path.join(process.env.LOGGINGDIR, 'userbroker.log');
winston.info('Setting up logging to ' + loggingLocation);
winston.add(winston.transports.File, { filename: loggingLocation, level: 'debug', json: false, prettyPrint: false });
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
	userRollupByDay: {},
	appBroker: {}
};

var streamsToUsers = {};

var eventModules = [];
eventModules.push(appBroker);
eventModules.push(userDailyAggregation);

var logger = {};

var setLogger = function(l){
	logger = Object.create(l);
	logger.info = function(key, message, data){
		if(data){
			l.info('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.info('userbroker: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			l.verbose('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.verbose('userbroker: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			l.error('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.error('userbroker: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			l.debug('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.debug('userbroker: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data) {
			l.silly('userbroker: ' + key + ': ' + message, data);
		}
		else
		{
			l.silly('userbroker: ' + key + ': ' + message);
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

	// when we go to the database, we leave the node event loop, this means that messages could come 
	// in for the new stream and we wouldn't know they are attached to the user. This means
	// we need to process the attaching stream here. 
	var streamIdAdded = userEvent.streamidAdded;
	if(streamIdAdded){
		streamsToUsers[streamIdAdded] = users[userEvent.username];
		logger.debug(userEvent.username, ["added mapping from ", streamIdAdded].join(''));
	}

	userRepository.findOne(condition, function(error, user){
		if(error){
			logger.error(userEvent.username, 'error while retrieving user', error);
			return;
		}

		if(user.username === undefined){
			logger.warn(userEvent.username, 'user found without a conforming schema, useranme missing: user: ', user);
			return;
		}

		cacheUser(user);
		logger.debug(userEvent.username, 'loaded user from database:', user);
	});
	
	logger.info(userEvent.username, 'processed a user event', userEvent);
};

var cronDaily = function(module){
	module.cronDaily(users, repos);
};

var subscribeMessage = function(channel, message){
	logger.info(channel, message);
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
		logger.info(channel, "recognised");
		if(message === 'cron/daily'){
			logger.info(message, 'asking processor to send users events to apps');
			_.forEach(eventModules, cronDaily);
		} 
		else if(/cron\/daily\/user\/([a-zA-Z0-9]+)\/date\/(\d{4}-\d{2}-\d{2})/.test(message)){
			var matches = /cron\/daily\/user\/([a-zA-Z0-9]+)\/date\/(\d{4}-\d{2}-\d{2})/.exec(message);
			var cronDailyUser = matches[1];
			var date = matches[2];

			logger.info(message, ['asking processor to send', cronDailyUser, 'to apps on', date].join(' '));
			_.forEach(eventModules, function(module){
				module.cronDaily([users[cronDailyUser]], repos, date);
			});
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
			if(user.username === undefined){
				logger.warn('user found without a conforming schema, useranme missing: user: ', user);
				return;
			}
			
			cacheUser(user);
		});

		_.map(eventModules, function(module){
			if(module.start){
				module.start(repos);
			}
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

var setAppBrokerRepo = function(appBrokerRepo){
	repos.appBroker = appBrokerRepo;
};

var setIdGenerator = function(generator){
	repos.idGenerator = generator;
};

module.exports = {};
module.exports.subscribeMessage = subscribeMessage;
module.exports.loadUsers = loadUsers;
module.exports.setLogger = setLogger;
module.exports.setUserRepo = setUserRepo;
module.exports.setUserRollupRepo = setUserRollupRepo;
module.exports.setAppBrokerRepo = setAppBrokerRepo;
module.exports.setIdGenerator = setIdGenerator;