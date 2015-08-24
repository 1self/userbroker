'use strict';
var _ = require('lodash');
var moment = require('moment');
var q = require('q');
var logger = require('winston');

q.longStackSupport = true;

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// you can type this character on a mac using shift+option+\
var MEASURE_DELIMITER = '.';

var reverseSortedIndexLodash = function(array, value, predicate){
	return _.sortedIndex(array, value, predicate);
};

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
		if(data !== undefined && data !== null){
			newLogger.info('userDailyAggregation: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.info('userDailyAggregation: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.verbose('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.verbose('userDailyAggregation: ' + key + ': ' + message);
		}
	};

	logger.warn = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.warn('userDailyAggregation: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.warn('userDailyAggregation: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.error('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.error('userDailyAggregation: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.debug('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.debug('userDailyAggregation: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.silly('userDailyAggregation: ' + key + ': ' + message, data);
		}
		else{
			newLogger.silly('userDailyAggregation: ' + key + ': ' + message);
		}
	};

};

var processEvent = function(streamEvent, user, repos){
	var whitelist = ["0","1me","anildigital","anti","awjudd","bensterling","bretsky","carebozaru","cemueses","chad_","chinmay185","chris1self","chriscobb","chrisyoong1self","creativeboulder","crochi","dantashman","dermy","devaroop","devika","doug","drazzie","dsitter","ed","edf","ehrenglaube","erbridge","ernestasju","fbtest","fonzzo@gmail.com","futoricky","handelxh","haroen","in8finity","jackmac92","jankal","jonah","komlev","laamanni","m","markpjohnson","martin","mbriscoe88","mick","mjstephenson","mobilpadde","nadyja","nblackburn","nfrigus","not-inept","osiloke","paulll","phil65","pj","psycrow","r1ffa","ranndom","rpowis","schisma","scottmuc","shaunstanislaus","shot5dev","singyouranthem","skinn","stamp","stormfighter","tekir","testuser","themaaarc","thenorthman","tomwrenn","toxel","vinaypuppal","willmedeiros","ybl"];

	if(_.indexOf(whitelist, user.username, true) === -1){
		logger.verbose(user.username, 'not on the whitelist, message not processed');
		return;
	}

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
	var conditionKey = [condition.userId + '', condition.objectTags.join(','), condition.actionTags.join(',')].join('/');

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

	var createKey = function(property, second){
		var result = [property, second.replace(/\.|\[|\]/g,function(match){
			if(match === '.'){
				return '^';
			}
			else if (match === '['){
				return '(';
			}
			else if (match === ']'){
				return ')';
			}

			throw 'matched unknown string';
		})].join(MEASURE_DELIMITER);

		return result;
	};

	var explodeArray = function(e, property){
		if(_.isString(e) === false){
			return;
		}

		var key = createKey(property, e);
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

				var key = createKey(property, propertyValue);
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
		condition.key = [conditionKey, date].join('/');
		logger.silly('calling insert');
		logger.silly('condition', JSON.stringify(condition));
		logger.silly('operation', JSON.stringify(operation));

		repos.userRollupByDay.update(condition, operation, options);
	});
};

var createDateCard = function(user, repos, params){
	logger.debug(user.username, "creating date card, [params]", params);
	return q.Promise(function(resolve, reject) {

		var card = {};
		card.id = repos.idGenerator();
		card.type = 'date';
		card.cardDate = params.date;
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
		var resolveParams = {};
		_.assign(resolveParams, params);
		resolve(resolveParams);
		return;

		repos.user.update(condition, operation, options, function(error){
			if(error){
				reject("Database error: " + error);
			}
			else{
				resolve(resolveParams);
			}
		});
	});
};

var createtop10Card = function(user, position, rollup, property, repos){
	return q.Promise(function(resolve, reject){
		logger.debug(user.username, 'Adding top10 card');

		if(rollup.variance < 0){
			logger.debug(user.username, 'variance is negative, ignoring for top 10, [actionTags, objectTags, value, variance, mean]', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve();
			return;	
		}

		if(isNaN(rollup.mean)){
			logger.debug(user.username, 'only a single value, no mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve();
			return;	
		}

		if(rollup.sampleCorrectedStdDev === 0){
			logger.debug(user.username, 'rollup is the same as mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve();
			return;	
		}

		var card = {};
		card.userId = rollup.userId;	
		card.type = "top10";
		card.outOf = rollup.outOf;
		card.thumbnailMedia = 'chart.html';
		card.startRange = rollup.date;
		card.endRange = rollup.date;
		card.objectTags = rollup.objectTags;
		card.actionTags = rollup.actionTags;
		card.position = position;
		card.properties = {};	
		_.set(card.properties, property, _.get(rollup, property));
		card.propertyName = rollup.propertyName;
		card.stdDev = rollup.stdDev;
		card.correctedStdDev = rollup.correctedStdDev;
		card.sampleStdDev = rollup.sampleStdDev;
		card.sampleCorrectedStdDev = rollup.sampleCorrectedStdDev;
		card.mean = rollup.mean;
		card.variance = rollup.variance;
		card.value = rollup.value;
		card.sortingValue = -(rollup.value);

		card.cardDate = rollup.date;
		card.generatedDate = new Date().toISOString();
		card.chart = ['/v1/users', user.username, 'rollups', 'day', rollup.objectTags, rollup.actionTags, encodeURIComponent(property), '.json'].join('/');

		var positionText;
		if(card.objectTags.toString() === 'computer,software' && card.actionTags.toString() === 'develop'){
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

		if(card.objectTags.toString() === 'computer,control,software,source' && card.actionTags.toString() === 'github,push' && property === '__count__'){
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

		logger.debug(user.username, 'Adding card, ', [card.propertyName]);
		repos.cards.insert(card, function(error, response){
			if(error){
				logger.error(user.username, 'error inserting card, [property, error]: ', [card.propertyName, error]);
				reject(error);			
			}
			else
			{
				logger.debug(user.username, 'top 10 card inserted, [property, response], : ', [card.propertyName, response.result]);
				resolve();
			}
		});
	});
};



var createBottom10Card = function(user, position, rollup, property, repos){
	return q.Promise(function(resolve, reject){

		logger.debug(user.username, 'Adding bottom10 card');
		var card = {};

		if(rollup.variance >= 0){
			logger.debug(user.username, 'variance is positive, ignoring for bottom 10');
			resolve();
			return;
		}

		if(isNaN(rollup.mean)){
			logger.debug(user.username, 'only a single value, no mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve();
			return;	
		}

		if(rollup.sampleCorrectedStdDev === 0){
			logger.debug(user.username, 'rollup is the same as mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve();
			return;	
		}

		card.userId = rollup.userId;
		card.type = "bottom10";
		card.outOf = rollup.outOf;
		card.thumbnailMedia = 'chart.html';
		card.startRange = rollup.date;
		card.endRange = rollup.date;
		card.objectTags = rollup.objectTags;
		card.actionTags = rollup.actionTags;
		card.position = position;
		card.properties = {};	
		_.set(card.properties, property, _.get(rollup, property));
		card.propertyName = rollup.propertyName;
		card.stdDev = rollup.stdDev;
		card.correctedStdDev = rollup.correctedStdDev;
		card.sampleStdDev = rollup.sampleStdDev;
		card.sampleCorrectedStdDev = rollup.sampleCorrectedStdDev;
		card.mean = rollup.mean;
		card.variance = rollup.variance;
		card.value = rollup.value;
		card.sortingValue = rollup.value;
		
		card.cardDate = rollup.date;
		card.generatedDate = new Date().toISOString();
		card.chart = ['/v1/users', user.username, 'rollups', 'day', rollup.objectTags, rollup.actionTags, encodeURIComponent(property), '.json'].join('/');

		var positionText;
		if(card.objectTags.toString() === 'computer,software' && card.actionTags.toString() === 'develop'){
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

		if(card.objectTags.toString() === 'computer,control,software,source' && card.actionTags.toString() === 'github,push' && property === '__count__'){
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

		logger.debug(user.username, 'Adding card, ', [card.propertyName]);
		repos.cards.insert(card, function(error, response){
			if(error){
				logger.error(user.username, 'bottom 10 error inserting card, [propertyName, error]: ', [card.propertyName, error]);
				reject(error);
			}
			else
			{
				logger.debug(user.username, 'bottom 10 card inserted, [property, response], : ', [card.propertyName, response.result]);
				resolve();
			}
		});
	});
};

var createTop10Insight = function(user, rollup, property, repos){
	return q.Promise(function(resolve, reject){
		var propertyPath = property.join(".");
		logger.debug([user.username, rollup.date].join(':'), 'analyzing top10', [propertyPath]);
		var condition = {
			$query: {
				userId: rollup.userId,
				actionTags: rollup.actionTags,
				objectTags: rollup.objectTags,
				date: {$lt: rollup.date}
			},
			$orderby: {}
		};

		condition.$query[propertyPath] = {$exists: true};
		condition.$orderby[propertyPath] = -1;

		var projection = {
			date: true,
			sum: true
		};

		logger.debug(user.username, 'retrieving top10 days, condition, projection: ', [condition, projection]);

		repos.userRollupByDay.find(condition).toArray(function(error, top10){
			logger.debug(user.username, 'retrieved the top10');

			rollup.value = _.get(rollup, propertyPath);
			
			var mean = (_.sum(top10, propertyPath) + rollup.value)  / (top10.length + 1);
			var rollupVariance = rollup.value - mean;
			var rollupVarianceSq = rollupVariance * rollupVariance;
			var sumSquares = rollupVarianceSq;

			sumSquares += _.reduce(top10, function(total, item){
				var variance = _.get(item, propertyPath) - mean;
				var varianceSq = variance * variance;
				total += varianceSq;
				if(isNaN(total)){
					logger.error(user.username, 'Error calculating sumSquares', item);
				}
				return total;
			}, 0);

			var variance = Math.sqrt(sumSquares);
			var stdDev = variance / top10.length;
			var correctedStdDev = top10.length === 1 ? variance : variance / (top10.length - 1);
			var propertyVariance = _.get(rollup, propertyPath) - mean;
			var sampleStdDev = stdDev === 0 ? 0 : Math.sqrt(propertyVariance * propertyVariance) / stdDev;
			var sampleCorrectedStdDev = correctedStdDev <= 0 ? 0 : Math.sqrt(propertyVariance * propertyVariance) / correctedStdDev;
			rollup.stdDev = stdDev;
			rollup.correctedStdDev = correctedStdDev;
			rollup.sampleStdDev = sampleStdDev;
			rollup.sampleCorrectedStdDev = sampleCorrectedStdDev;
			rollup.mean = mean;
			rollup.variance = propertyVariance;
			rollup.outOf = top10.length;
			rollup.propertyName = property.slice(-1).concat(property.slice(0, -1)).join('.');
			

			top10.filter

			var top10Index = _.sortedLastIndex(top10, rollup, function(r){
				return -(_.get(r, propertyPath));
			});

			if(top10Index >= 10){
				logger.debug(user.username, 'rollup didnt make it in top10');
				resolve(user, rollup, propertyPath, repos);
				return;
			}

			logger.debug(user.username, 'top 10 checking dateTimes: ', [rollup.date, rollup.date]);
			
			createtop10Card(user, top10Index, rollup, propertyPath, repos)
			.then(function(){
				logger.debug(user.username, 'top 10 finished with rollup, [propertyPath]', [propertyPath])
				resolve(user, rollup, propertyPath, repos);
			})
			.catch(function(error){
				reject(error);
			})
			.done();
		});
	});
};

var createBottom10Insight = function(user, rollup, property, repos){
	return q.Promise(function(resolve, reject){
		var propertyPath = property.join(".");
		logger.debug([user.username, rollup.date].join(':'), 'analyzing bottom10, [propertyPath]', [propertyPath]);
		var condition = {
			$query: {
				userId: rollup.userId,
				actionTags: rollup.actionTags,
				objectTags: rollup.objectTags,
				date: {$lt: rollup.date}
			},
			$orderby: {}
		};

		condition.$query[propertyPath] = {$exists: true};
		condition.$orderby[propertyPath] = 1;

		var projection = {
			date: true,
			sum: true
		};

		logger.debug(user.username, 'retrieving bottom10 days, condition, projection: ', [condition, projection]);

		repos.userRollupByDay.find(condition).limit(10).toArray(function(error, bottom10){
			logger.debug(user.username, 'retrieved the bottom10');

			if(bottom10.length === 0){
				logger.debug(user.username, 'nothing in the bottom10, [propertyPath]', propertyPath);
				resolve(user, rollup, propertyPath, repos);
				return;
			}

				rollup.value = _.get(rollup, propertyPath);
				var mean = (_.sum(bottom10, propertyPath) + rollup.value)  / (bottom10.length + 1);
				var rollupVariance = rollup.value - mean;
				var rollupVarianceSq = rollupVariance * rollupVariance;
				var sumSquares = rollupVarianceSq;

				sumSquares += _.reduce(bottom10, function(total, item){
					var variance = _.get(item, propertyPath) - mean;
					var varianceSq = variance * variance;
					total += varianceSq;
					if(isNaN(total)){
						logger.error(user.username, 'Error calculating sumSquares', item);
					}
					return total;
				}, 0);


				var variance = Math.sqrt(sumSquares);
				var stdDev = variance / bottom10.length;
				var correctedStdDev = bottom10.length === 1 ? variance : variance / (bottom10.length - 1);
				var propertyVariance = _.get(rollup, propertyPath) - mean;
				var sampleStdDev = stdDev === 0 ? 0 : Math.sqrt(propertyVariance * propertyVariance) / stdDev;
				var sampleCorrectedStdDev = correctedStdDev <= 0 ? 0 : Math.sqrt(propertyVariance * propertyVariance) / correctedStdDev;
				rollup.stdDev = stdDev;
				rollup.correctedStdDev = correctedStdDev;
				rollup.sampleStdDev = sampleStdDev;
				rollup.sampleCorrectedStdDev = sampleCorrectedStdDev;
				rollup.mean = mean;
				rollup.variance = propertyVariance;
				rollup.outOf = bottom10.length;
				rollup.propertyName = property.slice(-1).concat(property.slice(0, -1)).join('.');

				var bottom10Index = _.sortedLastIndex(bottom10, rollup, function(r){
					return _.get(r, propertyPath);
				});

				if(bottom10Index >= 10){
					logger.debug(user.username, 'rollup didnt make it in bottom 10');
					resolve(user, rollup, propertyPath, repos);
					return;
				}

				logger.debug(user.username, 'checking dateTimes: ', [rollup.date, rollup.date]);
				createBottom10Card(user, bottom10Index, rollup, propertyPath, repos)
				.then(function(){
					logger.debug(user.username, 'bottom 10 finished with rollup, [propertyPath]', [propertyPath])
					resolve(user, rollup, propertyPath, repos);
				})
				.catch(function(error){
					reject(error);
				})
				.done();
		});
	});
};


var createDailyInsightCards = function(user, repos, params){
	logger.	info(user.username, ['cron/daily', params.date , 'creating'].join(': '));
	logger.debug(user.username, 'params passed in are ', params);

	var createDatabaseQuery = function(queryParams){
		logger.debug(user.username, "creating database condition, [query params]", queryParams);
		var condition = {
			userId: user._id
		};

		if(queryParams.objectTags === undefined)
		{
			condition.objectTags = {$nin: ["twitter", "foursquare", "hackernews", "stackoverflow", "instagram"]}
		}
		else{
			condition.objectTags = {$all: queryParams.objectTags};
		}

		if(queryParams.actionTags){
			condition.actionTags = {$all: queryParams.actionTags};
		}

		if(queryParams.date){
			condition.date = queryParams.date;
		}
		else { // date === undefined
			throw "date wasnt specified for cron job";
		}

		return condition;
	};

	// eas: if there are any rollups that are children of a parent and have the same
	// mean and standard deviation, we can filter them out here. For example, if the author 
	// never changes for a user, it could be filtered out here.
	// Potentially, we could also go back and prune data that isn't any different for users 
	// to save space in the database.
	var getRollupsFromDatabase = function(condition){
		return q.Promise(function(resolve, reject){
			logger.debug(user.username, 'getting rollups from database, [condition]', condition);
			repos.userRollupByDay.find(condition).toArray(function(error, rollupsForDates){
				if(error){
					reject("error getting rollups from the database for " + user.username);
				}
				else{
					logger.debug(user.username, "database returned rollups, [rollup count]", rollupsForDates ? rollupsForDates.length : 0);
					resolve(rollupsForDates);
				}
			});
		});
	};

	var generateInsightsFromRollups = function(rollups){
		var createInsightForRollup = function(path, user, properties, repos, rollup){
			var result = [];
			for(var property in properties){
				var nextPath = path.slice();
				nextPath.push(property);
				var propertyVal = properties[property];
				if(_.isNumber(propertyVal)){
					var top10Promise = createTop10Insight(user, rollup, nextPath, repos);
					var bottom10Promise = createBottom10Insight(user, rollup, nextPath, repos);

					result.push(top10Promise);
					result.push(bottom10Promise);
				}
				else if(_.isObject(propertyVal)){
					var promises = createInsightForRollup(nextPath, user, properties[property], repos, rollup);
					result = result.concat(promises);
				}
			}

			return result;
		};

		var rollupPromises = [];

		logger.debug(user.username, 'found rollups for yesterday: ', rollups.length);
		for(var i = 0; i < rollups.length; i++){
			logger.debug(user.username, 'creating insights for actionTags, objectTags, sum:', [rollups.actionTags, rollups.objectTags, rollups.sum]);
			var rollup = rollups[i];
			var insightPromises = createInsightForRollup(['sum'], user, rollup.sum, repos, rollup);
			rollupPromises = rollupPromises.concat(insightPromises);
		}

		return q.all(rollupPromises);
	};

	var finishMessage = ['cron/daily', params.date, 'finished creating insights'].join(": ");
	var logFinished = function(){
		logger.info(user.username, finishMessage);
	};

	q.fcall(createDatabaseQuery, params)
	.then(getRollupsFromDatabase)
	.then(generateInsightsFromRollups)
	.then(logFinished)
	.catch(function(error){
		logger.error(user.username, 'error occurred while generating insight', error);
	})
	.done();
};

var cronDaily = function(users, repos, params){
	_.map(users, function(user){
		var whitelist = ["0","1me","anildigital","anti","awjudd","bensterling","bretsky","carebozaru","cemueses","chad_","chinmay185","chris1self","chriscobb","chrisyoong1self","creativeboulder","crochi","dantashman","dermy","devaroop","devika","doug","drazzie","dsitter","ed","edf","ehrenglaube","erbridge","ernestasju","fbtest","fonzzo@gmail.com","futoricky","handelxh","haroen","in8finity","jackmac92","jankal","jonah","komlev","laamanni","m","markpjohnson","martin","mbriscoe88","mick","mjstephenson","mobilpadde","nadyja","nblackburn","nfrigus","not-inept","osiloke","paulll","phil65","pj","psycrow","r1ffa","ranndom","rpowis","schisma","scottmuc","shaunstanislaus","shot5dev","singyouranthem","skinn","stamp","stormfighter","tekir","testuser","themaaarc","thenorthman","tomwrenn","toxel","vinaypuppal","willmedeiros","ybl"];
		if(_.sortedIndex(whitelist, user.username, true) === -1){
			logger.verbose(user.username, 'not on the whitelist, cron not running');
			return;
		}
		createDailyInsightCards(user, repos, params);
	});
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;
module.exports.reverseSortedIndexLodash = reverseSortedIndexLodash;
module.exports.reverseSortedIndex = reverseSortedIndex;
