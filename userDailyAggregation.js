'use strict';
var _ = require('lodash');
var logger = require('winston');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data){
			newLogger.info('userDailyAggregation: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.info('userDailyAggregation: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			newLogger.verbose('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.verbose('userDailyAggregation: ' + key + ': ' + message);
		}
	};

	logger.warning = function(key, message, data){
		if(data){
			newLogger.warning('userDailyAggregation: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.warning('userDailyAggregation: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			newLogger.error('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.error('userDailyAggregation: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			newLogger.debug('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.debug('userDailyAggregation: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data){
			newLogger.silly('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.silly('userDailyAggregation: ' + key + ': ' + message);
		}
	};

};

var processEvent = function(streamEvent, user, repos){
	logger.debug(user.username, 'processing event', streamEvent);

	if(streamEvent.objectTags === undefined){
		logger.warning(user.username, 'missing objectTags');
		return;
	}

	if(streamEvent.actionTags === undefined){
		logger.warning(user.username, 'missing actionTags');
		return;
	}

	if(streamEvent.dateTime === undefined){
		logger.warning(user.username, 'missing dateTime');
		return;
	}

	if(user._id === undefined){
		logger.warning(user.username, 'user is malformed');
		return;
	}

	// increment for the current hour
	var condition = {};
	condition.userId = user._id;
	condition.objectTags = _.sortBy(streamEvent.objectTags, function(tag){return tag.toLowerCase();});
	condition.actionTags = _.sortBy(streamEvent.actionTags, function(tag){return tag;});

	if(_.indexOf(condition.actionTags, 'sync')){
		logger.debug(user, "ignoring sync event");
	}

	condition.date = streamEvent.dateTime.substring(0, 10);
	var operation = {};

	_.map(streamEvent.properties, function(propValue, propKey){
		if(_.isNumber(propValue)){
			var increment = "properties." + propKey + "." + streamEvent.dateTime.substring(11, 13);
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