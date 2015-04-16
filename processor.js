'use strict';
var _ = require('lodash');
var request = require('request');
var logger = require('winston');
var crypto = require('crypto');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = newLogger;
};

var users = {};
var streamsToUsers = {};
var cryptoKey = process.env.USERBROKER_CRYPTOKEY;
var buffers = {};

var processStreamEvent = function(streamEvent){
	logger.info('processed an event', streamEvent);
	var streamid = streamEvent.streamid;
	logger.info('looking up user for streamid', streamid);
	var user = streamsToUsers[streamid];
	if(user === undefined){
		logger.info('no user found');
		return;
	}

	if(_.intersection(user.apps.devflow.objectTags, streamEvent.objectTags).length === 0){
		logger.info('event doesnt have devflow tags');
		return;
	}

	if(!(user.username === 'ed' || user.username === 'adrianbanks')){
		logger.info('event is for user not on the whitelist');
	}

	logger.info('making request to flow app');

	if(buffers[user.username] === undefined){
		buffers[user.username] = [];
	}

	var buffer = buffers[user.username];
	if(buffer.length < 20){
		buffer.push(streamEvent);
		buffers[user.username] = buffer;
		logger.info('adding to buffer (' + buffer.length + ')');
		return;
	}

	buffer.push(streamEvent);
	logger.info('time to process buffer');

	var requestBody = {};
	var userId = crypto.createHmac('sha256', cryptoKey).update(user.username).digest('hex');
	logger.debug('userId generated length', userId.length);

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
		logger.info('message brokered', {response: response.statusCode, body: response.body});
	});
	logger.info('processed event for user', user.username);
};

var cacheUser = function(user){
	users[user.username] = user;
	_.map(user.streams, function(stream){
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

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processStreamEvent = processStreamEvent;
module.exports.processUserEvent = processUserEvent;
module.exports.loadUsers = loadUsers;