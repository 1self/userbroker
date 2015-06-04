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


	if(_.indexOf(condition.actionTags, 'sync') >= 0){
		logger.debug(user.username, "ignoring sync event");
		return;
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

			var incrementSums = "sums." + propKey;
			operation['$inc'][incrementSums] = propValue;

			var incrementCounts = "counts." + propKey;
			operation['$inc'][incrementCounts] = 1;
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

var createCard = function(user, position, rollup, property, repos){
	logger.debug(user.username, 'Adding top10 card');
	var html = [];

	html.push('<header>');
	if(position === 0){
		html.push('<h1>Best ever day</h1>');
	}
	else if(position === 1){
		html.push('<h1>2nd best day</h1>');
	}
	else if(position === 2){
		html.push('<h1>3rd best day</h1>');
	}
	else{
		html.push('<h1>' + (position+1) + 'th best day');
	}
	
	html.push('<h2><ul>');
	for(var oTag in rollup.objectTags){
		html.push('<li>');
		html.push(oTag);
		html.push('</li>');
	}
	for(var aTag in rollup.actionTags){
		html.push('<li>');
		html.push(aTag);
		html.push('</li>');
	}
	html.push('</ul></h2');
	html.push('</header>');
	html.push('<nav>');
	html.push('<a href="/v1/me/events/' + rollup.objectTags.toString() + '/' + rollup.actionTags.toString() + 'sum(' + property + ')/daily/.barchart">this week</a>');
	html.push('<a href="/v1/me/events/' + rollup.objectTags.toString() + '/' + rollup.actionTags.toString() + 'sum(' + property + ')/daily/.barchart">this month</a>');
	html.push('<a href="/v1/me/events/' + rollup.objectTags.toString() + '/' + rollup.actionTags.toString() + 'sum(' + property + ')/daily/.barchart">this year</a>');
	html.push('</nav>');

	var condition = {
		_id: rollup.userId,
	};

	var operation = {
		$push: {
			cards: {
				front: html.join('')
			}
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
	condition.$orderby['sums.' + property] = -1;

	var projection = {
		date: true,
		sums: true
	};

	logger.debug(user.username, 'retrieving top10 days, condition, projection: ', [condition, projection]);

	repos.userRollupByDay.find(condition).limit(10).toArray(function(error, top10){
		logger.debug(user.username, 'retrieved the top10');
			var top10Index = -1;

			var low = 0;
			var high = top10.length;
			var mid = 0;
			var search = rollup.sums[property];
			while(low <= high){
				mid = (high + low) >> 1;
				if(mid >= top10.length){
					mid = top10.length;
					break;
				}

				if(search >= top10[mid].sums[property]){
					high = mid - 1;
				}
				else{
					low = mid + 1;
				}
			}
			// position is human, change indexing to be 1 based.
			top10Index = mid;

			if(top10Index >= 10){
				logger.debug(user.username, 'rollup didnt make it in top10');
				return;
			}

			logger.debug(user.username, 'checking dateTimes: ', [rollup.dateTime, rollup.dateTime]);
			createCard(user, top10Index, rollup, property, repos);
	});
};

var createDailyInsightCards = function(user, repos){
	var yesterday = new Date().toISOString().substring(0, 10); 
	var condition = {
		userId: user._id,
		date: yesterday
	};

	logger.info(user.username, 'creating daily insights');
	logger.debug(user.username, 'daily insights condition: ', condition);

	repos.userRollupByDay.find(condition).toArray(function(error, yesterdaysRollups){
		logger.debug(user.username, 'found rollups for yesterday: ', yesterdaysRollups.length);
		for(var i = 0; i < yesterdaysRollups.length; i++){
			logger.debug(user.username, 'creating insights for actionTags, objectTags, sums:', [yesterdaysRollups.actionTags, yesterdaysRollups.objectTags, yesterdaysRollups.sums]);
			for(var property in yesterdaysRollups[i].sums){
				createTop10Insight(user, yesterdaysRollups[i], property, repos);
			}
		}
	});
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