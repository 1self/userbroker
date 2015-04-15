'use strict';
var _ = require('lodash');
var request = require('request');
var logger = require('winston');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var setLogger = function (newLogger){
	logger = newLogger;
};

var users = {};
var streamsToUsers = {};

var processStreamEvent = function(streamEvent){
	logger.info('processed an event', streamEvent);
	var streamid = streamEvent.streamid;
	logger.info('looking up user for streamid', streamid);
	var user = streamsToUsers[streamid];
	if(user === undefined){
		logger.info('no user found');
		return;
	}

	streamEvent.user = user.username;
	logger.info('bbb');
	logger.info('making request to flow app');
	

	var streamEvents = [];
	streamEvents.push(streamEvent);
	var options = {
	  method: 'post',
	  body: streamEvents,
	  json: true,
	  url: 'http://devflow.azurewebsites.net/api/events'
	}

	request.post(options, function(error, response){
		logger.info('message brokered', response);
	});
	logger.info('processed event for user', user.username);

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

		logger.debug('loaded user from database:', user);

		users[user.username] = user;
		_.map(user.streams, function(stream){
			streamsToUsers[stream.streamid] = user;
			logger.debug('mapped ' + stream.streamid + ' to ' + user.username);
		});

	});
	
	logger.info('processed a user event', userEvent);
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processStreamEvent = processStreamEvent;
module.exports.processUserEvent = processUserEvent;