'use strict';
var _ = require('lodash');
var logger = require('winston');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = newLogger;
};

var processEvent = function(streamEvent, user, userRollupByDayRepo){
	logger.silly('userDailyAggregation: processing event');

	if(streamEvent._id === undefined || streamEvent.objectTags === undefined || streamEvent.actionTags === undefined || streamEvent.localEventDateTime === undefined){
		logger.silly('userDailyAggregation: event is malformed');
		return;
	}
	
	// increment for the current hour
	var condition = {};
	condition._id = user._id;
	condition.objectTags = streamEvent.objectTags;
	condition.actionTags = streamEvent.actionTags;
	condition.date = streamEvent.localEventDateTime.substring(0, 10);
	var operation = {
		'$inc': {}
	};

	_.map(streamEvent.properties, function(propValue, propKey){
		if(_.IsNumber(propValue)){
			var increment = "properties." + propKey + "." + streamEvent.eventLocalDateTime.substring(11, 2);
			operation.$inc[increment] = propValue;
		}
	});

	var options = {
		upsert: true
	};

	userRollupByDayRepo.insert(condition, operation, options);
};

var sendUserEventsToApps = function(user){
	logger.info('simulating using rollup to create user cards', user.username);
};

var cronDaily = function(users){
	// for computer,software/develop - figure out where yesterday lies in terms of life segment
	_.map(users, sendUserEventsToApps);
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;