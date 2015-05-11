'use strict';
var _ = require('lodash');
var request = require('request');
var logger = require('winston');
var crypto = require('crypto');

// Set default node environment to development
console.log(process === undefined);
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = {
		info: function(user, message, data){
			newLogger.info('appBroker: ' + user + ': ' + message, data);
		},
		verbose: function(user, message, data){
			newLogger.verbose('appBroker: ' + user + ': ' + message, data);
		},
		error: function(user, message, data){
			newLogger.error('appBroker: ' + user + ': ' + message, data);
		},
		debug: function(user, message, data){
			newLogger.debug('appBroker: ' + user + ': ' + message, data);
		},
		silly: function(user, message, data){
			newLogger.silly('appBroker: ' + user + ': ' + message, data);
		}
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
	logger.info(user.username, 'sending events to apps', user.username);
	var buffer = buffers[user.username];

	if(buffer === undefined){
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