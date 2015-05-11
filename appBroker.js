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
		data ? newLogger.info('userbroker: ' + key + ': ' + message, data)
			 : newLogger.info('userbroker: ' + key + ': ' + message);
	};

	logger.verbose = function(key, message, data){
		data ? newLogger.verbose('userbroker: ' + key + ': ' + message, data)
			 : newLogger.verbose('userbroker: ' + key + ': ' + message);
	};
	
	logger.error = function(key, message, data){
		data ? newLogger.error('userbroker: ' + key + ': ' + message, data)
			 : newLogger.error('userbroker: ' + key + ': ' + message);
	};
	
	logger.debug = function(key, message, data){
		data ? newLogger.debug('userbroker: ' + key + ': ' + message, data)
			 : newLogger.debug('userbroker: ' + key + ': ' + message);
	};

	logger.silly = function(key, message, data){
		data ? newLogger.silly('userbroker: ' + key + ': ' + message, data)
			 : newLogger.silly('userbroker: ' + key + ': ' + message);
	};

};

var cryptoKey = process.env.USERBROKER_CRYPTOKEY;
var buffers = {};

var processEvent = function(streamEvent, user){
	var streamid = streamEvent.streamid;
	logger.silly(user.username, 'processing event', streamid);

	if(user === undefined){
		logger.debug(user.username, 'no user found');
		return;
	}

	if(!(user.username === 'ed' || user.username === 'adrianbanks' || user.username === 'm'|| user.username === 'anildigital' || user.username === 'devika' || user.username === 'devaroop' || user.username === 'douglas'
		)){
		logger.verbose(user.username, 'event is for user not on the whitelist');
		return;
	}

	if(_.intersection(user.apps.devflow.objectTags, streamEvent.objectTags).length === 0){
		logger.info(user.username, 'event doesnt have devflow tags');
		return;
	}

	if(buffers[user.username] === undefined){
		buffers[user.username] = [];
	}

	var buffer = buffers[user.username];
	buffer.push(streamEvent);
	buffers[user.username] = buffer;
	logger.info(user.username, 'added to buffer (' + buffer.length + ')');
};

var sendUserEventsToApps = function(user){
	if(user.apps === undefined){
		return;
	}
	logger.info(user.username, 'sending events to apps', user.apps);
	var buffer = buffers[user.username];

	if(buffer === undefined){
		logger.debug(user.username, 'no buffer');
		return;
	}

	var requestBody = {};
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
	});
	logger.info(user.username, 'processed event for user', user.username);
};

var cronDaily = function(users){
	logger.info('cron/daily', 'received');
	_.map(users, sendUserEventsToApps);
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;