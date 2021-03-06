'use strict';
var _ = require('lodash');
var moment = require('moment');
var q = require('q');
var logger = require('winston');
var filtering = require('./filtering.js');
var utils = require('./cardsUtils.js');

q.longStackSupport = true;

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.info('cards: %s: %s', 	key, message, data);
		} 
		else {
			newLogger.info('cards: %s: %s', key, message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.verbose('cards: %s: %s', key, message, data);
		}
		else{
			newLogger.verbose('cards: %s: %s', key, message);
		}
	};

	logger.warn = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.warn('cards: %s: %s', key, message, data);
		} 
		else {
			newLogger.warn('cards: %s: %s', key, message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.error('cards: %s: %s', key, message, data);
		}
		else{
			newLogger.error('cards: %s: %s', key, message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.debug('cards: %s: %s', key, message, data);
		}
		else{
			newLogger.debug('cards: %s: %s', key, message);
		}
	};

	logger.silly = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.silly('cards: %s: %s', key, message, data);
		}
		else{
			newLogger.silly('cards: %s: %s', key, message);
		}
	};

};

var removeSchedule = function(user, repos, cardSchedule){
	return q.Promise(function(resolve, reject){
		var condition = {
			_id: cardSchedule._id
		};

		logger.silly(user.username, 'removing schdeule from the database', condition);

		repos.cardSchedule.remove(condition, function(error, result){
			if(error){
				logger.error(user.username, 'error occured while removing card schedule, [schedule, error]', [cardSchedule, error]);
				reject(error);
				return;
			}

			logger.debug(user.username, 'removed card schedules, ', [cardSchedule._id, result.n]);
			resolve();
		});
	});
};

var createTopCard = function(user, position, rollup, property, repos){
	return q.Promise(function(resolve, reject){
		logger.silly(user.username, 'Adding top cards');

		if(rollup.variance < 0){
			logger.silly(user.username, 'variance is negative, ignoring for top cards, [actionTags, objectTags, value, variance, mean]', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve(null);
			return;	
		}

		if(isNaN(rollup.mean)){
			logger.silly(user.username, 'only a single value, no mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve(null);
			return;	
		}

		if(rollup.sampleCorrectedStdDev === 0){
			logger.silly(user.username, 'rollup is the same as mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve(null);
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
		card.published = false;


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

		logger.silly(user.username, 'Adding card, ', [card.propertyName]);
		repos.cards.insert(card, function(error, response){
			if(error){
				logger.error(user.username, 'error inserting card, [property, error]: ', [card.propertyName, error]);
				reject(error);			
			}
			else
			{
				logger.silly(user.username, 'top 10 card inserted, [property, response], : ', [card.propertyName, response.result]);
				resolve(card._id);
			}
		});
	});
};

var createBottomCard = function(user, position, rollup, property, repos){
	return q.Promise(function(resolve, reject){

		logger.silly(user.username, 'Adding bottom card');
		var card = {};

		if(rollup.variance >= 0){
			logger.silly(user.username, 'variance is positive, ignoring for bottom 10');
			resolve(null);
			return;
		}

		if(isNaN(rollup.mean)){
			logger.silly(user.username, 'only a single value, no mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve(null);
			return;	
		}

		if(rollup.sampleCorrectedStdDev === 0){
			logger.silly(user.username, 'rollup is the same as mean', [rollup.date, rollup.objectTags, rollup.actionTags, rollup.propertyName, rollup.value, rollup.variance, rollup.mean]);
			resolve(null);
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
		card.published = false;

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

		logger.silly(user.username, 'Adding card, ', [card.propertyName]);
		repos.cards.insert(card, function(error, response){
			if(error){
				logger.error(user.username, 'bottom 10 error inserting card, [propertyName, error]: ', [card.propertyName, error]);
				reject(error);
			}
			else
			{
				logger.silly(user.username, 'bottom 10 card inserted, [property, response], : ', [card.propertyName, response.result]);
				resolve(card._id);
			}
		});
	});
};

var createTopInsightForProperty = function(user, rollup, property, repos){
	return q.Promise(function(resolve, reject){
		var propertyPath = property.join(".");
		logger.silly([user.username, rollup.date].join(':'), 'analyzing top10', [propertyPath]);

		var pipeline = [];

		var match = {$match: {
    			userId: rollup.userId,
    			objectTags: rollup.objectTags,
    			actionTags: rollup.actionTags,
    			date: {$lt: rollup.date}
    		}
    	};
    	match.$match[propertyPath] = {$exists: true};
		pipeline.push(match);

		var sort = {$sort: {}};
		sort.$sort[propertyPath] = -1;
		pipeline.push(sort);

		pipeline.push({$limit: 10});

		var project = {};
		project.$project = {
			value: '$' + propertyPath
		};
		pipeline.push(project);

		// var condition = {
		// 	$query: {
		// 		userId: rollup.userId,
		// 		actionTags: rollup.actionTags,
		// 		objectTags: rollup.objectTags,
		// 		date: {$lt: rollup.date}
		// 	},
		// 	$orderby: {}
		// };

		// condition.$query[propertyPath] = {$exists: true};
		// condition.$orderby[propertyPath] = -1;

		// var projection = {
		// 	date: true,
		// 	sum: true
		// };

		// projection[propertyPath] = true;

		//logger.silly(user.username, 'retrieving top10 days, condition, projection: ', [condition, projection]);

		repos.userRollupByDay.aggregate(pipeline).toArray(function(error, top10){
			logger.silly(user.username, 'retrieved the top10');
			if(!top10){
				logger.warn(user.username, 'mismatch between schedule and rollup', {aTags: rollup.actionTags, oTags: rollup.objectTags, propertyPath: propertyPath});
				resolve(null);
				return;
			}

			rollup.value = _.get(rollup, propertyPath);
			
			var sum = _.sum(top10, 'value');
			var mean = (sum + rollup.value)  / (top10.length + 1);
			var rollupVariance = rollup.value - mean;
			var rollupVarianceSq = rollupVariance * rollupVariance;
			var sumSquares = rollupVarianceSq;

			sumSquares += _.reduce(top10, function(total, item){
				var variance = item.value - mean;
				var varianceSq = variance * variance;
				total += varianceSq;
				if(isNaN(total)){
					logger.error(user.username, 'Error calculating sumSquares', JSON.stringify(item));
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

			var top10Index = _.sortedLastIndex(top10, rollup, function(r){
				return -(r.value);
			});

			if(top10Index >= 3){
				logger.silly(user.username, 'rollup didnt make it in top 3');
				resolve(null); // no card created
				return;
			}

			logger.silly(user.username, 'top 10 checking dateTimes: ', [rollup.date, rollup.date]);
			
			createTopCard(user, top10Index, rollup, propertyPath, repos)
			.then(function(cardId){
				logger.silly(user.username, 'top 10 finished with rollup, [propertyPath]', [propertyPath]);
				resolve(cardId);
			})
			.catch(function(error){
				reject(error);
			})
			.done();
		});
	});
};

var createBottomInsightForPropery = function(user, rollup, property, repos){
	return q.Promise(function(resolve, reject){
		var propertyPath = property.join(".");
		logger.silly([user.username, rollup.date].join(':'), 'analyzing bottom10, [propertyPath]', [propertyPath]);
		var pipeline = [];

		var match = {$match: {
    			userId: rollup.userId,
    			objectTags: rollup.objectTags,
    			actionTags: rollup.actionTags,
    			date: {$lt: rollup.date}
    		}
    	};
    	match.$match[propertyPath] = {$exists: true};
		pipeline.push(match);

		var sort = {$sort: {}};
		sort.$sort[propertyPath] = 1;
		pipeline.push(sort);

		pipeline.push({$limit: 10});

		var project = {};
		project.$project = {
			value: '$' + propertyPath
		};
		pipeline.push(project);

		repos.userRollupByDay.aggregate(pipeline).limit(10).toArray(function(error, bottom10){
			logger.debug(user.username, 'retrieved the bottom10', [rollup.objectTags, rollup.actionTags, rollup.date, propertyPath]);
			if(bottom10 === undefined){
				logger.warn(user.username,'mismatch between schedule and rollup', {oTags: rollup.objectTags, aTags: rollup.actionTags, propertyPath: propertyPath});
				resolve(null);
				return;
            }

			if(bottom10.length === 0){
				logger.silly(user.username, 'nothing in the bottom10, [propertyPath]', propertyPath);
				resolve(null);
				return;
			}

			rollup.value = _.get(rollup, propertyPath);
			var sum = _.sum(bottom10, 'value');
			var mean = (sum + rollup.value)  / (bottom10.length + 1);
			var rollupVariance = rollup.value - mean;
			var rollupVarianceSq = rollupVariance * rollupVariance;
			var sumSquares = rollupVarianceSq;

			sumSquares += _.reduce(bottom10, function(total, item){
				var variance = item.value - mean;
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
				return r.value;
			});

			if(bottom10Index >= 1){
				logger.silly(user.username, 'rollup didnt make it in bottom 1');
				resolve(null); // card wasn't created
				return;
			}

			logger.silly(user.username, 'checking dateTimes: ', [rollup.date, rollup.date]);
			createBottomCard(user, bottom10Index, rollup, propertyPath, repos)
			.then(function(cardId){
				logger.silly(user.username, 'bottom 10 finished with rollup, [propertyPath]', [propertyPath]);
				resolve(cardId);
			})
			.catch(function(error){
				reject(error);
			})
			.done();
		});
	});
};

var getUserCardCount = function(user, repos){
	return q.Promise(function(resolve, reject){
		logger.silly(user.username, 'getting card count');
		var pipeline = [];
		pipeline.push({
			$match: {userId: user._id}
		});

		pipeline.push({ $group: { _id: null, count: { $sum: 1 } } });

		repos.cards.aggregate(pipeline, function(error, response){
			if(error){
				logger.error(user.username, 'error getting card count', error);
				reject(error);
			}
			else{
				var count = response[0] ? response[0].count : 0;
				logger.debug(user.username, 'number of cards: ', count);
				resolve(count);
			}
		});
	});
};

var setUserCardCount = function(user, repos, cardCount){
	return q.Promise(function(resolve, reject){
		logger.debug(user.username, 'setting card count ', cardCount);
		var condition = {
			_id: user._id
		};

		var operation = {
			$set: {cardCount: cardCount}
		};

		var options = {
			$multi: false
		};

		repos.user.update(condition, operation, options, function(error, response){
			if(error){
				logger.error(user.username, 'error setting card count on user', error);
				reject(error);
			} 
			else {
				logger.silly(user.username, 'card count was set on user', response.result);
				resolve(response);
			}
		});
	});
};

var generateCardsForDay = function(user, repos, params){
	logger.debug(user.username, [params.date , 'creating insights'].join(': '));
	logger.debug(user.username, 'params passed in are ', params);

	

	var createDatabaseQuery = function(queryParams){
		logger.silly(user.username, 'creating database condition, [query params]', queryParams);
		var condition = {
			userId: user._id
		};

		if(queryParams.objectTags === undefined)
		{
			condition.objectTags = {$nin: ['twitter', 'foursquare', 'hackernews', 'stackoverflow', 'instagram']};
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
			logger.silly(user.username, 'getting rollups from database, [condition]', JSON.stringify(condition));
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

	var generateCards = function(rollups){
		logger.silly(user.username, 'generating insights from rollups');
		var createInsightForRollup = function(path, user, properties, repos, rollup){
			var result = [];
			for(var property in properties){

				var nextPath = path.slice();
				nextPath.push(property);
				var propertyVal = properties[property];
				if(_.isNumber(propertyVal)){
					if(filtering.generateCardsForRollupProperty(rollup.objectTags, rollup.actionTags, property)){
						var top10Promise = createTopInsightForProperty(user, rollup, nextPath, repos);
						var bottom10Promise = createBottomInsightForPropery(user, rollup, nextPath, repos);

						result.push(top10Promise);
						result.push(bottom10Promise);
					}				
				}
				else if(_.isObject(propertyVal)){
					var promises = createInsightForRollup(nextPath, user, properties[property], repos, rollup);
					result = result.concat(promises);
				}
			}

			return result;
		};

		var rollupPromises = [];

		logger.debug(user.username, [params.date, 'found rollups'].join(':'), [params.date, rollups.length]);
		for(var i = 0; i < rollups.length; i++){
			logger.silly(user.username, 'creating insights for actionTags, objectTags, sum:', [rollups.actionTags, rollups.objectTags, rollups.sum]);
			var rollup = rollups[i];
			var insightPromises = createInsightForRollup(['sum'], user, rollup.sum, repos, rollup);
			rollupPromises = rollupPromises.concat(insightPromises);
		}

		return q.all(rollupPromises);
	};

	var finishMessage = [params.date, 'finished creating insights'].join(": ");
	var logFinished = function(){
		logger.debug(user.username, finishMessage);
	};

	var result = [];
	var captureCardIds = function(cardIds){
		result = cardIds;
	};

	var resolveCardIds = function(){
		return result;
	};

	var condition = createDatabaseQuery(params);
	return getRollupsFromDatabase(condition)
	.then(generateCards)
	.then(captureCardIds)
	.then(function(/*cardIds*/){return getUserCardCount(user, repos);})
	.then(function(cardCount){return setUserCardCount(user, repos, cardCount);})
	.then(logFinished)
	.then(resolveCardIds)
	.catch(function(error){
		logger.error(user.username, 'error occurred while generating insight', error);
	});
};

var removeExistingCards = function(user, repos, params){
	return q.Promise(function(resolve, reject){
		logger.silly(user.username, 'removing existing cards, [date, objectTags, actionTags]', [params.date, params.objectTags, params.actionTags]);
		var condition = {
			userId: user._id,
			cardDate: params.date,
			objectTags: {$all: params.objectTags},
			actionTags: {$all: params.actionTags}
		};

		repos.cards.remove(condition, function(error, response){
			if(error){
				reject(error);
			}
			else{
				logger.debug(user.username, 'removed cards, [date, objectTags, actionTags, count]', [condition.cardDate, condition.objectTags, condition.actionTags, response.result.n]);
				resolve();
			}
		});
	});
};

var createCardsForDate = function(user, repos, params){
	return q.Promise(function(resolve, reject){
		logger.debug(user.username, params.date + ': cards: started', [params.objectTags, params.actionTags]);

		return removeExistingCards(user, repos, params)
		.then(function(){
			return generateCardsForDay(user, repos, params);
		})
		.then(function(cardIds){
			logger.debug(user.username, params.date + ': cards: finished, params, cardIds count', [params, cardIds ? cardIds.length : 0]);
			resolve(cardIds);
		})
		.catch(function(error){
			logger.error(user.username, 'creating cards for date failed, error', error);
			reject(error);
		});
	});
};

var publishCards = function(user, repos, cardIds){
	return q.Promise(function(resolve, reject){
		var condition = {
			_id: {
				$in: cardIds 
			}
		};

		var operation = {
			$set: {
				published: true
			}
		};

		var options = {
			multi: true
		};

		repos.cards.update(condition, operation, options, function(error, response){
			if(error){
				reject(error);
			}
			else{
				logger.debug(user.username, 'published cards, cards updated ', response.result.nModified);
				resolve(cardIds);
			}
		});
	});
};

var processCardSchedules = function(user, repos, streamEvent){
	
	

	return q.Promise(function(resolve, reject){
		logger.silly(user.username, 'processing card schedules, streamEvent', streamEvent);
		var promise = q();

		var condition = {};

		condition.$query = {
			userId: user._id
		};

		if(streamEvent && streamEvent.streamid){
			condition.$query.streamid = streamEvent.streamid;
		}

		condition.$sort = {
			date: 1
		};

		var scheduleCount = 0;
		var createdCardIds = [];
		var cursor = repos.cardSchedule.find(condition);
		cursor.each(function(error, cardSchedule){
			if(error){
				logger.error(user.username, 'error from db while processing sync end event', error);
				return;
			}

			if(cardSchedule === null){
				promise = promise.then(function(){
					var validCardIds = _(createdCardIds).flatten().filter(Boolean).value(); // filters out nulls, which are given when a card can't be created for a property
					logger.info(user.username, 'processed schedules', {count: scheduleCount});
					logger.silly(user.username, 'processed card schedules, streamid, schedule count', [condition.streamid, scheduleCount]);
					logger.debug(user.username, 'publishing cards, count', validCardIds.length);
					logger.silly(user.username, 'publishing cards, count', validCardIds);
					return publishCards(user, repos, validCardIds);
				});

				promise = promise.then(function(cardIds){
					logger.debug(user.username, 'finished publishing cards');
					resolve(cardIds);
				})
				.catch(function(error){
					logger.error(user.username, 'error while processing sync end event', error);
					reject(error);
				});
				return promise;
			}

			var dateParams = [];

			_.forEach(cardSchedule.tags, function(value, key){
				var splits = key.split('/');

				var objectTags = splits[0];
				var actionTags = splits[1];
				dateParams.push({
					date: cardSchedule.date,
					objectTags: objectTags.split(','),
					actionTags: actionTags.split(','),
				});
			});

			if(cardSchedule.tags){
				scheduleCount += _.keys(cardSchedule.tags).length;
			}

			logger.silly(user.username, 'creating cards for schedules, scheduleCount', dateParams.length);

			dateParams.forEach(function(dateParam){
				promise = promise.then(function(){
					return createCardsForDate(user, repos, dateParam);
				});

				promise = promise.then(function(cardIdsForDate){
					createdCardIds.push(cardIdsForDate);
					return removeSchedule(user, repos, cardSchedule);
				});
			});
		});

		
	});
};



var addSyncingCard = function(streamEvent, user, repos){
	return q.Promise(function(resolve, reject){
		var date = streamEvent.dateTime.substring(0, 10);
		logger.silly(user.username, 'adding sync card', [date, streamEvent.source]);

		var card = {};
		card.userId = user._id;	
		card.type = "datasyncing";
		card.thumbnailMedia = 'chart.html';
		card.source = streamEvent.source;
		card.cardDate = date;
		card.generatedDate = new Date().toISOString();
		card.published = true;
		

		logger.silly(user.username, 'Adding sync card, inserting ', card);
		repos.cards.insert(card, function(error, response){
			if(error){
				logger.error(user.username, 'error inserting sync card', [error, streamEvent.source]);
				reject(error);			
			}
			else
			{
				logger.debug(user.username, 'sync card inserted', [streamEvent.source, response.result]);
				resolve();
			}
		});
	});
};

var removeSyncingCard = function(streamEvent, user, repos){
	return q.Promise(function(resolve, reject){
		var date = streamEvent.dateTime.substring(0, 10);
		logger.silly(user.username, 'removing syncing card', [date, streamEvent.source]);
		var condition = {
			userId: user._id,
			cardDate: date,
			type: 'datasyncing',
			source: streamEvent.source
		};

		logger.silly(user.username, 'removing syncing card, condition', condition);
		repos.cards.remove(condition, function(error, response){
			if(error){
				logger.error(user.username, 'error removing sync card', [error, streamEvent.source]);
				reject(error);
			}
			else{
				logger.debug(user.username, 'removed syncing card, count', response.result.n);
				resolve();
			}
		});
	});
};

var addCardsGeneratingCard = function(streamEvent, user, repos){
	return q.Promise(function(resolve, reject){
		var date = streamEvent.dateTime.substring(0, 10);
		logger.silly(user.username, 'adding cards generating card', [date, streamEvent.source]);
		var card = {};
		card.userId = user._id;	
		card.type = "cardsgenerating";
		card.thumbnailMedia = 'chart.html';
		card.source = streamEvent.source;
		card.cardDate = date;
		card.generatedDate = new Date().toISOString();
		card.published = true;

		logger.silly(user.username, 'adding cards inserting', card);

		repos.cards.insert(card, function(error, response){
			if(error){
				logger.error(user.username, 'error inserting cards generating card', [error, streamEvent.source]);
				reject(error);			
			}
			else
			{
				logger.debug(user.username, 'cards generating card inserted', [streamEvent.source, response.result]);
				resolve();
			}
		});
	});
};

var removeCardsGeneratingCard = function(streamEvent, user, repos){
	return q.Promise(function(resolve, reject){
		var date = streamEvent.dateTime.substring(0, 10);
		logger.silly(user.username, 'removing cards generating card', [date, streamEvent.source]);
		var condition = {
			userId: user._id,
			cardDate: date,
			type: 'cardsgenerating',
			source: streamEvent.source
		};

		logger.silly(user.username, 'removing cards condition', condition);
		repos.cards.remove(condition, function(error, response){
			if(error){
				logger.error(user.username, 'error removing cards generating card', [error, streamEvent.source]);
				reject(error);
			}
			else{
				logger.debug(user.username, 'removed cards generating card, count', response.result.n);
				resolve();
			}
		});
	});
};

var addFirstSync = function(user, streamEvent){
	if(user.firstSyncs === undefined){
		user.firstSyncs = {};
	}

	user.firstSyncs[streamEvent.streamid] = true;
};

var removeFirstSync = function(user, streamEvent){
	delete user.firstSyncs[streamEvent.streamid];
};

var processEvent = function(streamEvent, user, repos){
	logger.silly(user.username, 'processing event');
	if(_.indexOf(streamEvent.objectTags, 'sync') === -1){
		return;
	}

	if(_.indexOf(streamEvent.actionTags, 'start') >= 0){
		logger.debug(user.username, 'processing sync start');
		return utils.isFirstSync(logger, streamEvent, user, repos)
		.then(function(isFirstSync){
			if(isFirstSync){
				addFirstSync(user, streamEvent);
				return addSyncingCard(streamEvent, user, repos);
			}
			else{
				return q();
			}
		})
		.then(function(){
			return getUserCardCount(user, repos);
		})
		.then(function(cardCount){
			return setUserCardCount(user, repos, cardCount);
		});
	}
	else if(_.indexOf(streamEvent.actionTags, 'complete') >= 0){
		logger.debug(user.username, 'processing sync complete, using card schedules to create cards');
		return removeSyncingCard(streamEvent, user, repos)
		.then(function(){	
			if(user.firstSyncs[streamEvent.streamid]){
				removeFirstSync(user, streamEvent);
				return addCardsGeneratingCard(streamEvent, user, repos);
			}
			else{
				return q();
			}
		})
		.then(function(){
			return processCardSchedules(user, repos, streamEvent);
		})
		.then(function(){
			logger.info(user.username, 'finished processing card schedules');
			return removeCardsGeneratingCard(streamEvent, user, repos);
		});
	}
	else if(_.indexOf(streamEvent.actionTags, 'error') >= 0 || _.indexOf(streamEvent.actionTags, 'Error') >= 0 ){
		logger.error(user.username, 'a sync error was seen');
		// TODO: notify the user, check for a 401 and ask the user to re-auth
		return;
	}

	logger.error(user.username, 'unknown sync type seen', [streamEvent.objectTags, streamEvent.actionTags]);
	return;
};

var getLastReadDate = function(params){
	return q.Promise(function(resolve, reject){
		var pipeline = [];
		pipeline.push({
			$match: {
				userId: params.user._id, 
				read: true, 
				archive: {$ne: false},
				cardDate: {$lte: params.date}
			}
		});

		pipeline.push({
			$group: {
				_id: 0, 
				maxDate: {$max: "$cardDate"}
			}
		});

		logger.silly(params.user.username, 'getting the last read date, pipeline', pipeline);
		params.repos.cards.aggregate(pipeline, function(error, result){
			if(error){
				reject(error);
			}
			else{
				params.maxDate = result.length > 0 ? result[0].maxDate : null;
				logger.debug(params.user.username, 'archiving cards, last read date is ', params.maxDate);
				resolve(params);
			}
		});
	});
};

var archiveOldCards = function(params){
		return q.Promise(function(resolve, reject){
			if(params.maxDate === null){
				resolve(params);
			}

			var condition = {
				userId: params.user._id ,
				archive: {$ne: true},
				cardDate: {$lte: params.maxDate}
			};

			var operation = {
				$set: {archive: true}
			};

			var options = {multi: true};

			logger.silly(params.user.username, 'archive: updating cards, [condition, operation]', [condition, operation]);
			params.repos.cards.update(condition, operation, options, function(error, response){
				if(error){
					reject(error);
				}
				else{
					logger.debug(params.user.username, 'archived cards', response.result);
					resolve(params);
				}
			});
		});
	};

var archiveUser = function(user, repos, params){

	logger.debug(user.username, 'archiving users read cards');

	// assume that this is a shared object and make our own copy
	var paramsForUser = {
		date: params.date,
		repos: repos,
		user: user
	};

	return getLastReadDate(paramsForUser)
	.then(archiveOldCards);
};

var archive = function(users, repos, params){
	logger.debug('', 'archiving users from ', params.date);

	var promise = q();
	_.values(users).forEach(function (user) {
		promise = promise.then(archiveUser(user, repos, params));
	});
	promise = promise.then(function(){
		q.Promise(function(resolve){
			logger.info('', 'finished archiving');
			resolve();
		});
	})
	.catch(function(error){
		logger.error('', 'error occurred while archiving', error);
	})
	.done();
};

var cronDaily = function(users, repos, params){
	logger.debug('', 'cron daily requested');
	var promise = q();
	
	utils.getSortedUsers(users).value().forEach(function(user){
		logger.info(user.username, 'cron daily for user');
		promise = promise.then(function(){
			archiveUser(user, repos, params);	
		})
		.then(function(){
			return processCardSchedules(user, repos);
		});
	});

	promise.catch(function(error){
			logger.error('', 'error while running cron daily, error', error);
	})
	.done();
};

var groundsForRejection = function(user, repos, params){
	var result = [];
	if(user === undefined){
		result.push('user is undefined');
	}

	if(repos === undefined){
		result.push('repos is not defined');
	}

	if(params.objectTags === undefined){
		result.push('object tags are not defined');
	}

	if(params.actionTags === undefined){
		result.push('action tags are not defined');
	}

	if(params.from === undefined){
		result.push('from date is not defined');
	}

	if(params.to === undefined){
		result.push('to date is not defined');
	}

	return result;
};

var removeExistingCardsRange = function(user, repos, params){
	return q.Promise(function(resolve, reject){
		logger.silly(user.username, 'removing existing cards');
		var condition = {
			userId: user._id,
			cardDate: {
				$gt: params.from,
				$lt: params.to + 'Z'
			},
			objectTags: {$all: params.objectTags},
			actionTags: {$all: params.actionTags}
		};

		repos.cards.remove(condition, function(error, response){
			if(error){
				reject(error);
			}
			else{
				logger.info(user.username, 'removed cards, count', response.result.n);
				resolve();
			}
		});
	});
};

var recreateCardsForTagsAndDateRange = function(user, repos, params){
	return q.Promise(function(resolve, reject){
		var grounds = groundsForRejection(user, repos, params);
		if(grounds.length > 0){
			reject(grounds.join(','));
			return;
		}

		logger.info(user.username, 'starting card recreation, params', params);
		logger.silly(user.username, 'creating date range');
		var dateRange = moment(params.from).twix(params.to, {allDay: true});
		logger.silly(user.username, 'creating date array');
		var iter = dateRange.iterate("days");
		logger.silly(user.username, 'created date array');
		var dateParams = [];
		while(iter.hasNext()){
			dateParams.push({
				objectTags: params.objectTags,
				actionTags: params.actionTags,
				date: iter.next().toISOString().substring(0,10)
			});
		}

		var promise = removeExistingCardsRange(user, repos, params);
		
		var collectedCardIds = [];
		dateParams.forEach(function(dateParam){
			promise = promise.then(function(){
				return generateCardsForDay(user, repos, dateParam);
			}).then(function(cardIds){
				collectedCardIds.push(cardIds);
			});
		});

		promise.then(function(){
			var validCardIds = _(collectedCardIds).flatten().filter(Boolean).value(); // filters out nulls, which are given when a card can't be created for a property
			logger.debug(user.username, 'publishing cards, count', validCardIds.length);
			return publishCards(user, repos, validCardIds);
		}).then(function(cardIds){
			logger.info(user.username, 'finished recreating cards, params', params);
			resolve(cardIds);
		});
	});
};



module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronWeekly = cronDaily;
module.exports.archive = archive;
module.exports.recreateCardsForTagsAndDateRange = recreateCardsForTagsAndDateRange;