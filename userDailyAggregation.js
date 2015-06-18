'use strict';
var _ = require('lodash');
var logger = require('winston');

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// you can type this character on a mac using shift+option+\
var MEASURE_DELIMITER = '.'

var reverseSortedIndexLodash = function(array, value, predicate){
	return _.sortedIndex(array, value, predicate);
}
var reverseSortedIndex = function(array, value, predicate){
	var result = -1;

	var low = 0;
	var high = array.length;
	var current = 0;
	var search = value;
	while(low < high){
		// uncomment these lines if you want to see how this algorithm works
		//console.log('');
		//console.log('low: ' + low);
		//console.log('high: ' + high);
		current = (high + low) >> 1;
		//console.log('current: ' + current);
		if(current >= array.length){	
			current = array.length;
			break;
		}

		if(search >= predicate(array[current])){
			high = current;
		}
		else if(search < predicate(array[current])){
			low = current + 1;
		}
		else{
			break;
		}
	}
	result = low;
	return result;
};

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

	logger.warn = function(key, message, data){
		if(data){
			newLogger.warn('userDailyAggregation: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.warn('userDailyAggregation: ' + key + ': ' + message);
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


	if(_.indexOf(condition.objectTags, 'sync') >= 0){
		logger.debug(user.username, "ignoring sync event");
		return;
	}

	condition.date = streamEvent.dateTime.substring(0, 10);
	var operation = {};

	// adding in the count here ensures that every event type will
	// appear in the rollup. Count is represented by #
	streamEvent.properties['#'] = 1;

	var explodedLabels = [];
	var measures = {};
	var explode = function(properties, labels, measurePrefix){
		for(var property in properties){
			var propertyValue = properties[property];
			if(_.isString(propertyValue)){
				var key = [property, properties[property].replace(/\./g,'^')].join(MEASURE_DELIMITER);
				explodedLabels.push(key);
			}
			else if(_.isArray(propertyValue)){
				_.each(propertyValue, function(e){
					if(_.isString(e) === false){
						return;
					}

					var key = [property, e.replace(/\./g,'^')].join(MEASURE_DELIMITER);
					explodedLabels.push(key);
				});
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
	}

	explode(streamEvent.properties, explodedLabels, '');

	for(var prop in measures){
		for (var i = 0; i < explodedLabels.length; i++) {
			var key = [explodedLabels[i], prop].join(MEASURE_DELIMITER);
			measures[key] = measures[prop];
		}
	}

	_.map(measures, function(propValue, propKey){
		var increment = "properties." + propKey + "." + streamEvent.dateTime.substring(11, 13);
		if(operation['$inc'] === undefined){
			operation['$inc'] = {};
		}
		operation['$inc'][increment] = propValue;

		var incrementSums = "sum." + propKey;
		operation['$inc'][incrementSums] = propValue;

		var incrementCounts = "count." + propKey;
		operation['$inc'][incrementCounts] = 1;
	});

	var options = {
		upsert: true
	};

	logger.silly('calling insert');
	logger.silly('condition', JSON.stringify(condition));
	logger.silly('operation', JSON.stringify(operation));
	repos.userRollupByDay.update(condition, operation, options);
};

var createDateCard = function(user, repos){

	var card = {};
	card.id = repos.idGenerator();
	card.type = 'date';
	card.generatedDate = new Date().toISOString();

	var condition = {
		_id: user._id,
	};

	var operation = {
		$push: {
			cards: card
		}
	};

	var options = {
		upsert: true
	};

	logger.debug(user.username, 'Adding date card');
	repos.user.update(condition, operation, options);
}

function getDescendantProp(obj, desc) {
    var arr = desc.split(".");
    while(arr.length && (obj = obj[arr.shift()]));
    return obj;
}

function setDescendantProp(obj, desc, value) {
    var arr = desc.split(".");
    var currentObj = obj;
    for (var i = 0; i < arr.length; i++) {
    	if(i === arr.length - 1){
    		currentObj[arr[i]]		 = value;
    	}
    	else{
    		currentObj[arr[i]] = currentObj[arr[i]] === undefined ? {} : currentObj[arr[i]];
    		currentObj = obj[arr[i]];
    	}
    };
}

var createtop10Card = function(user, position, rollup, property, repos){
	logger.debug(user.username, 'Adding top10 card');
	var card = {};
	card.id = repos.idGenerator();
	card.type = "top10";
	card.thumbnailMedia = 'chart.html';
	card.startRange = rollup.date;
	card.endRange = rollup.date;
	card.objectTags = rollup.objectTags;
	card.actionTags = rollup.actionTags;
	card.position = position;
	card.properties = {};	
	setDescendantProp(card.properties, property, getDescendantProp(rollup, property));
	card.generatedDate = new Date().toISOString();
	card.chart = ['/v1/users', user.username, 'rollups', 'day', rollup.objectTags, rollup.actionTags, property, '.json'].join('/');

	if(card.objectTags.toString() === 'computer,software' && card.actionTags.toString() === 'develop'){
		var positionText;
		if(position === 0){
			positionText = '';
		} 
		else if(position === 1){
			positionText = '2nd ';
		} 
		else if(position === 2) {
			positionText = '3rd ';	
		}
		else{
			positionText = '' + (position + 1) + 'th ';
		}

		card.cardText = positionText + 'highest minutes of coding';
	}

	if(card.objectTags.toString() === 'computer,control,software,source' && card.actionTags.toString() === 'github,push' && property === '#'){
		var positionText;
		if(position === 0){
			positionText = '';
		} 
		else if(position === 1){
			positionText = '2nd ';
		} 
		else if(position === 2) {
			positionText = '3rd ';	
		}
		else{
			positionText = '' + (position + 1) + 'th ';
		}
		card.cardText = positionText + 'highest ever number of pushes';
	}

	if(card.objectTags.toString() === 'computer,control,software,source' && card.actionTags.toString() === 'github,push' && property === 'commits'){
		var positionText;
		if(position === 0){
			positionText = '';
		} 
		else if(position === 1){
			positionText = '2nd ';
		} 
		else if(position === 2) {
			positionText = '3rd ';	
		}
		else{
			positionText = '' + (position + 1) + 'th ';
		}

		card.cardText = positionText + 'highest ever number of commits';
	}

	var condition = {
		_id: rollup.userId,
	};

	var operation = {
		$push: {
			cards: card
		}
	};

	var options = {
		upsert: true
	};

	logger.debug(user.username, 'Adding card, condition, operation, options', [condition, operation, options]);
	repos.user.update(condition, operation, options, function(error, response){
		logger.debug(user.username, 'card insertion response: ', error);
	});
};



var createBottom10Card = function(user, position, rollup, property, repos){
	logger.debug(user.username, 'Adding bottom10 card');
	var card = {};
	card.id = repos.idGenerator();
	card.type = "bottom10";
	card.thumbnailMedia = 'chart.html';
	card.startRange = rollup.date;
	card.endRange = rollup.date;
	card.objectTags = rollup.objectTags;
	card.actionTags = rollup.actionTags;
	card.position = position;
	card.properties = {};	
	setDescendantProp(card.properties, property, getDescendantProp(rollup, property));
	card.generatedDate = new Date().toISOString();
	card.chart = ['/v1/users', user.username, 'rollups', 'day', rollup.objectTags, rollup.actionTags, property, '.json'].join('/');

	if(card.objectTags.toString() === 'computer,software' && card.actionTags.toString() === 'develop'){
		var positionText;
		if(position === 0){
			positionText = '';
		} 
		else if(position === 1){
			positionText = '2nd ';
		} 
		else if(position === 2) {
			positionText = '3rd ';	
		}
		else{
			positionText = '' + (position + 1) + 'th ';
		}

		card.cardText = positionText + 'lowest minutes of coding';
	}

	if(card.objectTags.toString() === 'computer,control,software,source' && card.actionTags.toString() === 'github,push' && property === '#'){
		var positionText;
		if(position === 0){
			positionText = '';
		} 
		else if(position === 1){
			positionText = '2nd ';
		} 
		else if(position === 2) {
			positionText = '3rd ';	
		}
		else{
			positionText = '' + (position + 1) + 'th ';
		}

		card.cardText = positionText + 'lowest ever number of pushes';
	}

	if(card.objectTags.toString() === 'computer,control,software,source' && card.actionTags.toString() === 'github,push' && property === 'commits'){
		var positionText;
		if(position === 0){
			positionText = '';
		} 
		else if(position === 1){
			positionText = '2nd ';
		} 
		else if(position === 2) {
			positionText = '3rd ';	
		}
		else{
			positionText = '' + (position + 1) + 'th ';
		}

		card.cardText = positionText + 'lowest ever number of commits';
	}

	var condition = {
		_id: rollup.userId,
	};

	var operation = {
		$push: {
			cards: card
		}
	};

	var options = {
		upsert: true
	};

	logger.debug(user.username, 'Adding card, condition, operation, options', [condition, operation, options]);
	repos.user.update(condition, operation, options);
};

var createTop10Insight = function(user, rollup, property, repos){
	logger.debug(user.username, 'analyzing top10');
	var condition = {
		$query: {
			userId: rollup.userId,
			actionTags: rollup.actionTags,
			objectTags: rollup.objectTags
		},
		$orderby: {}
	};
	condition.$query[property] = {$exists: true};
	condition.$orderby[property] = -1;

	var projection = {
		date: true,
		sum: true
	};

	logger.debug(user.username, 'retrieving top10 days, condition, projection: ', [condition, projection]);

	repos.userRollupByDay.find(condition).limit(100).toArray(function(error, top10){
		logger.debug(user.username, 'retrieved the top10');
			if(top10.length <= 3){
				logger.debug(user.username, 'Less than 3 entries in top 10: ', property);
				return;
			}

			var top10Index = _.sortedIndex(top10, rollup, function(r){
				return -(_.get(r, property));
			})

			if(top10Index >= 100){
				logger.debug(user.username, 'rollup didnt make it in top10');
				return;
			}


			logger.debug(user.username, 'checking dateTimes: ', [rollup.dateTime, rollup.dateTime]);
			createtop10Card(user, top10Index, rollup, property, repos);
	});
};

var createBottom10Insight = function(user, rollup, property, repos){
	logger.debug(user.username, 'analyzing bottom10');
	var condition = {
		$query: {
			userId: rollup.userId,
			actionTags: rollup.actionTags,
			objectTags: rollup.objectTags
		},
		$orderby: {}
	};
	condition.$query[property] = {$exists: true};
	condition.$orderby[property] = 1;

	var projection = {
		date: true,
		sum: true
	};

	logger.debug(user.username, 'retrieving bottom10 days, condition, projection: ', [condition, projection]);

	repos.userRollupByDay.find(condition).limit(100).toArray(function(error, bottom10){
		logger.debug(user.username, 'retrieved the bottom10');
			if(bottom10.length <= 3){
				logger.debug(user.username, 'Less than 3 entries in bottom 10: ', property);
				return;
			}

			var bottom10Index = _.sortedIndex(bottom10, rollup, function(r){
				return _.get(r, property);
			})

			if(bottom10Index >= 100){
				logger.debug(user.username, 'rollup didnt make it in bottom 10');
				return;
			}


			logger.debug(user.username, 'checking dateTimes: ', [rollup.dateTime, rollup.dateTime]);
			createBottom10Card(user, bottom10Index, rollup, property, repos);
	});
};

var createDailyInsightCards = function(user, repos){
	createDateCard(user, repos);

	var d = new Date();
	d.setDate(d.getDate() - 1);
	var yesterday = d.toISOString().substring(0, 10); 
	var condition = {
		userId: user._id,
		date: yesterday
	};


	logger.info(user.username, 'creating daily insights');
	logger.debug(user.username, 'daily insights condition: ', condition);

	var createInsightForRollup = function(path, user, properties, repos, rollup){
		for(var property in properties){
			var propertyPath = [path, property].join('.');
			var propertyVal = properties[property];
			if(_.isNumber(propertyVal)){
				createTop10Insight(user, rollup, propertyPath, repos);
				createBottom10Insight(user, rollup, propertyPath, repos);
			}
			else if(_.isObject(propertyVal)){
				createInsightForRollup(propertyPath, user, rollup[property], repos, rollup);
			}
		}
	}

	repos.userRollupByDay.find(condition).toArray(function(error, yesterdaysRollups){
		logger.debug(user.username, 'found rollups for yesterday: ', yesterdaysRollups.length);
		for(var i = 0; i < yesterdaysRollups.length; i++){
			logger.debug(user.username, 'creating insights for actionTags, objectTags, sum:', [yesterdaysRollups.actionTags, yesterdaysRollups.objectTags, yesterdaysRollups.sum]);
			var rollup = yesterdaysRollups[i];
			createInsightForRollup('sum', user, rollup.sum, repos, rollup);
		}
	});

	logger.info(user.username, 'finished creating insights');
};

var cronDaily = function(users, repos){
	_.map(users, function(user){
		createDailyInsightCards(user, repos);
	});
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;
module.exports.reverseSortedIndexLodash = reverseSortedIndexLodash;
module.exports.reverseSortedIndex = reverseSortedIndex;
