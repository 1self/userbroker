'use strict';
var _ = require('lodash');
var logger = require('winston');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = newLogger;
};

var processEvent = function(streamEvent, user, repos){
	logger.silly('userDailyAggregation: processing event', streamEvent);

	if(streamEvent.objectTags === undefined){
		logger.debug('userDailyAggregation: missing objectTags');
		return;
	}

	if(streamEvent.actionTags === undefined){
		logger.debug('userDailyAggregation: missing actinTags');
		return;
	}

	if(streamEvent.localEventDateTime === undefined){
		logger.debug('userDailyAggregation: missing localEventDateTime');
		return;
	}

	if(user._id === undefined){
		logger.debug('userDailyAggregation: user is malformed');
		return;
	}

	// increment for the current hour
	var condition = {};
	condition.userId = user._id;
	condition.objectTags = _.sortBy(streamEvent.objectTags, function(tag){return tag});
	condition.actionTags = _.sortBy(streamEvent.actionTags, function(tag){return tag});
	condition.date = streamEvent.localEventDateTime.substring(0, 10);
	var operation = {
	};

	_.map(streamEvent.properties, function(propValue, propKey){
		if(_.isNumber(propValue)){
			var increment = "properties." + propKey + "." + streamEvent.localEventDateTime.substring(11, 13);
			if(operation['$inc'] === undefined){
				operation['$inc'] = {};
			}
			operation['$inc'][increment] = propValue;
		}
	});

	var options = {
		upsert: true
	};

	logger.silly('calling insert');
	logger.silly('condition', JSON.stringify(condition));
	logger.silly('operation', JSON.stringify(operation));
	repos.userRollupByDay.update(condition, operation, options);
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