'use strict';
var _ = require('lodash');
var request = require('request');
var logger = require('winston');
var crypto = require('crypto');

// Set default node environment to development
console.log(process === undefined);
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = newLogger;
};

var cryptoKey = process.env.USERBROKER_CRYPTOKEY;
var buffers = {};

var processEvent = function(streamEvent, user){
	var streamid = streamEvent.streamid;
	logger.silly('appBroker: processing event', streamid);

	if(user === undefined){
		logger.debug('appBroker: no user found');
		return;
	}

	if(!(user.username === 'ed' || user.username === 'adrianbanks' || user.username === 'm'|| user.username === 'anildigital' || user.username === 'devika' || user.username === 'devaroop' || user.username === 'douglas'
		)){
		logger.verbose('appBroker: event is for user not on the whitelist');
		return;
	}

	if(_.intersection(user.apps.devflow.objectTags, streamEvent.objectTags).length === 0){
		logger.info('appBroker: event doesnt have devflow tags');
		return;
	}
	logger.info('appBroker: making request to flow app');

	if(buffers[user.username] === undefined){
		buffers[user.username] = [];
	}

	var buffer = buffers[user.username];
	buffer.push(streamEvent);
	buffers[user.username] = buffer;
	logger.info('appBroker: adding to buffer (' + buffer.length + ')');
};

var sendUserEventsToApps = function(user){
	if(user.apps === undefined){
		return;
	}
	logger.info('appBroker: sending events to apps', user.username);
	var buffer = buffers[user.username];

	if(buffer === undefined){
		return;
	}

	var requestBody = {};
	var userId = crypto.createHmac('sha256', cryptoKey).update(user.username).digest('hex');
	logger.debug('appBroker: userId generated length', userId.length);

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
		logger.info('appBroker: messages successfully sent to flow', {response: response.statusCode, body: response.body});
	});
	logger.info('appBroker: processed event for user', user.username);
};

var cronDaily = function(users){
	_.map(users, sendUserEventsToApps);
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;