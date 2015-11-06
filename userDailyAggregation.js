'use strict';
var _ = require('lodash');
var moment = require('moment');
var q = require('q');
var logger = require('winston');
var utils = require('./userDailyAggregationUtils.js');

q.longStackSupport = true;

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// you can type this character on a mac using shift+option+\
var MEASURE_DELIMITER = '.';

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.info('userDailyAggregation: %s: %s', 	key, message, data);
		} 
		else {
			newLogger.info('userDailyAggregation: %s: %s', key, message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.verbose('userDailyAggregation: %s: %s', key, message, data);
		}
		else{
			newLogger.verbose('userDailyAggregation: %s: %s', key, message);
		}
	};

	logger.warn = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.warn('userDailyAggregation: %s: %s', key, message, data);
		} 
		else {
			newLogger.warn('userDailyAggregation: %s: %s', key, message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.error('userDailyAggregation: %s: %s', key, message, data);
		}
		else{
			newLogger.error('userDailyAggregation: %s: %s', key, message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.debug('userDailyAggregation: %s: %s', key, message, data);
		}
		else{
			newLogger.debug('userDailyAggregation: %s: %s', key, message);
		}
	};

	logger.silly = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.silly('userDailyAggregation: %s: %s', key, message, data);
		}
		else{
			newLogger.silly('userDailyAggregation: %s: %s', key, message);
		}
	};

};

var updateUserTagIndex = function(user, streamEvent, objectTagsKey, actionTagsKey, objectTags, actionTags, repos){
	var condition = {
		userId: user._id,
		streamId: streamEvent.streamid,
		tagKey: objectTagsKey + '/' + actionTagsKey,
		objectTags: objectTags,
		actionTags: actionTags,
	};

	var operation = {
		$inc: {count: 1}
	};

	var options = {
		upsert: true
	};

	// fire and forget on the index, not meant to be a perfect record, just to help
	// with know when to do different things for the user
	repos.userTagIndexes.update(condition, operation, options, function(error, response){
		if(error){
			logger.error(user.username, 'failed to update index, error', error);
		}
		else{
			logger.silly(user.username, 'updated index ', response.result.nModified);
		}
	});
};

var processEvent = function(streamEvent, user, repos){
	logger.debug(user.username, 'processing event', streamEvent);

	if(streamEvent.objectTags === undefined){
		logger.warn(user.username, 'missing objectTags');
		return;
	}

	if(streamEvent.actionTags === undefined){
		logger.warn(user.username, 'missing actionTags');
		return;
	}

	if(streamEvent.dateTime === undefined){
		logger.warn(user.username, 'missing dateTime');
		return;
	}

	if(user._id === undefined){
		logger.warn(user.username, 'user is malformed');
		return;
	}

	// increment for the current hour
	var condition = {};
	condition.userId = user._id;
	condition.objectTags = _.sortBy(streamEvent.objectTags, function(tag){return tag.toLowerCase();});
	condition.objectTags = condition.objectTags.map(function(tag){return tag.toLowerCase();});
	condition.actionTags = _.sortBy(streamEvent.actionTags, function(tag){return tag.toLowerCase();});
	condition.actionTags = condition.actionTags.map(function(tag){return tag.toLowerCase();});

	var objectTagsKey = condition.objectTags.join(',');
	var actionTagsKey = condition.actionTags.join(',');
	var key = [condition.userId + '', objectTagsKey, actionTagsKey].join('/');

	updateUserTagIndex(user, streamEvent, objectTagsKey, actionTagsKey, condition.objectTags, condition.actionTags, repos);

	if(_.indexOf(condition.objectTags, 'sync') >= 0){
		logger.debug(user.username, "ignoring sync event");
		return;
	}

	var operations = {};

	// adding in the count here ensures that every event type will
	// appear in the rollup. 
	streamEvent.properties['__count__'] = 1;

	var explodedLabels = [];
	var measures = {};

	

	var explodeArray = function(e, property){
		if(_.isString(e) === false){
			return;
		}

		var key = utils.createKey(property, e, MEASURE_DELIMITER);
		explodedLabels.push(key);
	};

	var explode = function(properties, labels, measurePrefix){
		for(var property in properties){
			var propertyValue = properties[property];
			if(_.isString(propertyValue)){
				if(_.isEmpty(propertyValue)){
					logger.debug('skipping empty property value', [property, propertyValue]	);
					continue;
				}

				var key = utils.createKey(property, propertyValue, MEASURE_DELIMITER);
				explodedLabels.push(key);
			}
			else if(_.isArray(propertyValue)){
				_.each(propertyValue, explodeArray);
			}
			else if(_.isObject(propertyValue)){
				var newPrefix = measurePrefix ? [measurePrefix, property].join(MEASURE_DELIMITER) : property;
				explode(propertyValue, labels, newPrefix);
			}
			else if(_.isNumber(propertyValue)){
				var measureKey = measurePrefix ? [measurePrefix, property].join(MEASURE_DELIMITER) : property;
				measures[measureKey] = propertyValue;
			}
		}
	};

	explode(streamEvent.properties, explodedLabels, '');

	for(var prop in measures){		
		for (var i = 0; i < explodedLabels.length; i++) {
			var key = [explodedLabels[i], prop].join(MEASURE_DELIMITER);
			measures[key] = measures[prop];
		}
	}

	_.chain(measures)
	.map(function(propValue, propKey){
		var result = [];
		
		if(/(\-|^)duration($|\-)/.test(propKey)){
			// 12:52
			// duration is 8000

			// 12: 52 * 60        / 8000 - 3120 = 4880
			// 11: 60 * 60        / 4880 - 3600 = 1280
			// 10: 1280           / 0


			// 17th 01:52
			// duration is 8000

			// 17th 01:         52 * 60        / 8000 - 3120 = 4880
			// 17th 00:         60 * 60        / 4880 - 3600 = 1280
			// 16th 23:         1280           / 0

			// 180
			var durationLeft = propValue;

			var bucketStart = moment(streamEvent.dateTime);

			while(durationLeft > 0){
				var secondsIntoTheHour = bucketStart.minutes() * 60 + bucketStart.seconds();
				secondsIntoTheHour = secondsIntoTheHour === 0 ? 3600 : secondsIntoTheHour;
				var bucketDuration = Math.min(durationLeft, secondsIntoTheHour);

				durationLeft = durationLeft - bucketDuration;

				if(durationLeft < 0){
					throw 'error while spreading duration to the rollups';
				}
				
				bucketStart = moment(bucketStart.add( -bucketDuration, 's'));
				
				var measure = {
					date: bucketStart.toISOString(),
					key: propKey,
					value: bucketDuration
				};
				
				result.push(measure); 
			}
		}
		else{
			result = {
				date: moment(streamEvent.dateTime).toISOString(),
				key: propKey,
				value: propValue
			};
		}

		return result;
	})
	.flatten()
	.forEach(function(measure){
        logger.silly(user.username, "adding measure, [measure]", measure);
		var dayDate = measure.date.substring(0, 10);
		var increment = "properties." + measure.key + "." + measure.date.substring(11, 13);
		var incrementCounts = "count." + measure.key;
		var incrementSums = "sum." + measure.key;

		if(operations[dayDate] === undefined){
			operations[dayDate] = {};
		}

		if(operations[dayDate]['$inc'] === undefined){
			operations[dayDate]['$inc'] = {};
		}

		if(operations[dayDate]['$inc'][increment] === undefined){
			operations[dayDate]['$inc'][increment] = 0;
		}

		if(operations[dayDate]['$inc'][incrementSums] === undefined){
			operations[dayDate]['$inc'][incrementSums] = 0;
		}

		if(operations[dayDate]['$inc'][incrementCounts] === undefined){
			operations[dayDate]['$inc'][incrementCounts] = 0;
		}

		operations[dayDate]['$inc'][increment] = measure.value;
		operations[dayDate]['$inc'][incrementSums] += measure.value;
		operations[dayDate]['$inc'][incrementCounts] += 1;	
	})
	.value();

	var options = {
		upsert: true
	};

	_.forEach(operations, function(operation, date){
		condition.date = date;
		condition.key = [key, date].join('/');
		logger.silly('calling insert');
		logger.silly('condition', JSON.stringify(condition));
		logger.silly('operation', JSON.stringify(operation));

		repos.userRollupByDay.update(condition, operation, options);
	});
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = function(){};