'use strict';
var _ = require('lodash');
var request = require('request');
var logger = require('winston');
var crypto = require('crypto');

// Set default node environment to development
console.log(process === undefined);
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data){
			newLogger.info('appBroker: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.info('appBroker: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			newLogger.verbose('appBroker: ' + key + ': ' + message, data);
		}
		else{
			newLogger.verbose('appBroker: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			newLogger.error('appBroker: ' + key + ': ' + message, data);
		}
		else{
			newLogger.error('appBroker: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			newLogger.debug('appBroker: ' + key + ': ' + message, data);
		}
		else{
			newLogger.debug('appBroker: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data){
			newLogger.silly('appBroker: ' + key + ': ' + message, data);
		}
		else{
			newLogger.silly('appBroker: ' + key + ': ' + message);
		}
	};

};

var cryptoKey = process.env.USERBROKER_CRYPTOKEY;
logger.info('config', 'crypto key is', cryptoKey.substring(0,2));
var buffers = {};

var addToRepo = function(repo, username, event){
	delete event.eventLocalDateTime;
	delete event.eventDateTime;

	var condition = {
		username: username,
	};

	var operation = {
		$push: {events: event}
	};

	var options = {
		upsert: true
	};

	logger.info(username, 'adding to repo: condition, operation, options: ', [condition, operation]);
	repo.update(condition, operation, options, function(error){
		logger.info(username, 'db update result: error', [error]);
	});
};

var addToMemory = function(username, event){
	logger.debug(username, "adding to memory", event);
	if(buffers[username] === undefined){
		buffers[username] = [];
	
	}

	var buffer = buffers[username];
	buffer.push(event);
	buffers[username] = buffer;
	logger.info(username, 'added to buffer (' + buffer.length + ')', event.dateTime);
};

var start = function(repos){
	repos.appBroker.find().toArray(function(error, docs){
		if(docs === undefined || docs.length === 0){
			return;
		}
		_.map(docs[0].events, function(event){
			addToMemory(docs[0].username, event);
		});
	});
};

var deleteFromDatabase = function(username, repo){
	var condition = {
		username: username,
	};

	var operation = {
		$set: {events: []}
	};

	var options = {
		upsert: true
	};

	repo.update(condition, operation, options);
};

var processEvent = function(streamEvent, user, repos){
	var streamid = streamEvent.streamid;
	logger.debug(user.username, 'processing event', streamid);

	if(user === undefined){
		logger.debug(user.username, 'no user found');
		return;
	} 

	if(!(user.username === 'adrianbanks' || user.username === 'anildigital' || user.username === 'devika' || user.username === 'devaroop' || user.username === 'douglas'
		)){
		logger.verbose(user.username, 'event is for user not on the whitelist');
		return;
	}

	if(user.apps === undefined || user.apps.devflow === undefined){
		logger.debug(user.username, 'doesnt have the devflow app');
		return; 
	}

	if(_.intersection(user.apps.devflow.objectTags, streamEvent.objectTags).length === 0){
		logger.info(user.username, 'event doesnt have devflow tags');
		return;
	}

	logger.info(user.username, 'about to add to memory');
	addToMemory(user.username, streamEvent);
	addToRepo(repos.appBroker, user.username, streamEvent);
};



var cronDaily = function(users, repos){
	logger.info('cron/daily', 'received');
	logger.debug('users is ', users);

	var sendUserEventsToApps = function(user){
		if(user === undefined){
			logger.info('unknown', 'user unknown');
			return;
		}
		
		if(user.apps === undefined){
			return;
		}
		logger.info(user.username, 'sending events to apps', user.apps);
		var buffer = buffers[user.username];

		if(buffer === undefined || buffer.length === 0){
			logger.debug(user.username, 'no buffer');
			return;
		}

		var requestBody = {};
		logger.info(user.username, 'trying');
		var userId = crypto.createHmac('sha256', cryptoKey).update(user.username).digest('hex');
		logger.debug(user.username, 'userId generated length', userId.length);

		requestBody.userId = userId;
		requestBody.streamid = user.apps.devflow.streamid;
		requestBody.writeToken = user.apps.devflow.writeToken;
		
		var streamEvents = buffer.slice();
		buffers[user.username] = [];
		requestBody.events = streamEvents;

		var options = {
		  method: 'post',
		  body: requestBody,
		  json: true,
		  url: 'http://devflow.azurewebsites.net/api/events'
		};

		request.post(options, function(error, response){
			logger.info(user.username, 'messages successfully sent to flow', {response: response.statusCode, body: response.body});
			deleteFromDatabase(user.username, repos.appBroker);
		});

		logger.info(user.username, 'processed event for user', user.username);
	};

	_.map(users, sendUserEventsToApps);
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;
module.exports.start = start;
