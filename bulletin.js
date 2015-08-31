'use strict';
var _ = require('lodash');
var moment = require('moment');
var q = require('q');
var logger = require('winston');

q.longStackSupport = true;

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data){
			newLogger.info('bulletin: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.info('bulletin: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			newLogger.verbose('bulletin: ' + key + ': ' + message, data);
		}
		else{
			newLogger.verbose('bulletin: ' + key + ': ' + message);
		}
	};

	logger.warn = function(key, message, data){
		if(data){
			newLogger.warn('bulletin: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.warn('bulletin: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			newLogger.error('bulletin: ' + key + ': ' + message, data);
		}
		else{
			newLogger.error('bulletin: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			newLogger.debug('bulletin: ' + key + ': ' + message, data);
		}
		else{
			newLogger.debug('bulletin: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data){
			newLogger.silly('bulletin: ' + key + ': ' + message, data);
		}
		else{
			newLogger.silly('bulletin: ' + key + ': ' + message);
		}
	};

};

var getTheLastBulletinDate = function(repos, user){
	return q.Promise(function(resolve, reject){
		var pipeline = [];
		pipeline.push({
			$match: {
				userId: user._id
			}
		});

		pipeline.push({
			$group: {	
				_id: 0, 
				lastDate: {$max: '$date'}
			}
		});

		repos.bulletin.aggregate(pipeline, function(error, response){
			if(error){
				reject(error);
			}
			else{
				var params = {};
				params.repos = repos;
				params.user = user;
				params.lastBulletin = response[0] !== undefined ? response[0].lastDate : null;
				resolve(params);
			}
		});
	});
}

var getAllTimeHighestSoftwareDevelop = function(params){
	return q.Promise(function(resolve, reject){
		var pipeline = [];
		pipeline.push({
			$match: {
				userId: params.user._id,
				objectTags: ['computer', 'software'],
				actionTags: ['develop']	
			}
		});

		pipeline.push({
			$sort: {'sum.duration': -1}
		});

		pipeline.push({
			$limit: 1
		});

		params.repos.userRollupByDay.aggregate(pipeline, function(error, response){
			if(error){
				reject(error);
			}
			else{
				params.highestSoftwareDevelop = {};
				if(response[0] !== undefined){
					params.highestSoftwareDevelop.value = response[0].sum.duration;
					params.highestSoftwareDevelop.date = response[0].date;
				}
				resolve(params);
			}
		});
	})
}

var getFastestFingersDayForBulletin = function(params){
	return q.Promise(function(resolve, reject){
		var pipeline = [];
		pipeline.push({
			$match: {
				userId: params.user._id,
				objectTags: ['computer', 'software'],
				actionTags: ['develop'],
				date: {$gt: params.lastBulletin}
			}
		});

		pipeline.push({
			$sort: {'sum.duration': -1}
		});

		pipeline.push({
			$limit: 1
		});

		params.repos.userRollupByDay.aggregate(pipeline, function(error, response){
			if(error){
				reject(error);
			}
			else{
				params.highestSoftwareDevelopSinceLastBulletin = {};
				if(response[0] !== undefined){
					params.highestSoftwareDevelopSinceLastBulletin.value = response[0].sum.duration;
					params.highestSoftwareDevelopSinceLastBulletin.date = response[0].date;
				} 
				else{
					params.highestSoftwareDevelopSinceLastBulletin.value = params.highestSoftwareDevelop.value;
					params.highestSoftwareDevelopSinceLastBulletin.date = params.highestSoftwareDevelop.date;
				}

				resolve(params);
			}
		});
	})
}

var createBulletin = function(params){
	return q.Promise(function(resolve, reject){
		if(params.highestSoftwareDevelop === undefined){
			resolve(params);
			return;
		}

		var doc = {
			userId: params.user._id,
			date: moment().toISOString().substring(0,10),
			highestSoftwareDevelop: params.highestSoftwareDevelop,
			highestSoftwareDevelopSinceLastBulletin: params.highestSoftwareDevelopSinceLastBulletin
		};

		params.repos.bulletin.insert(doc, function(error, response){
			if(error){
				reject(error);
			}
			else{
				logger.info(params.user.username, 'added bulletin', response.result);
			}
		});
	});
}

var send = function(repos, users){
	logger.info('preparing bulletin ', '', moment().toISOString());
	// eas: see http://edsykes.blogspot.com/2015/07/a-text-only-trick-for-retrieving-day.html 
	// for an explanation of why I add Z to the date.

	_.forEach(users, function(user){	
		if(user.username !== 'ed' ){
			return;
		}

		getTheLastBulletinDate(repos, user)
		.then(getAllTimeHighestSoftwareDevelop)
		.then(getFastestFingersDayForBulletin)
		.then(createBulletin)
		.catch(function(error){
			logger.error(user.username, error);
		})
		.done();
	})
};


module.exports = {};
module.exports.setLogger = setLogger;
module.exports.send = send;
