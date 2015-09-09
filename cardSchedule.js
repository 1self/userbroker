'use strict';
var _ = require('lodash');
var request = require('request');
var logger = require('winston');
var crypto = require('crypto');

// Set default node environment to development
console.log(process === undefined);
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data){
			newLogger.info('cardSchedule: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.info('cardSchedule: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			newLogger.verbose('cardSchedule: ' + key + ': ' + message, data);
		}
		else{
			newLogger.verbose('cardSchedule: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			newLogger.error('cardSchedule: ' + key + ': ' + message, data);
		}
		else{
			newLogger.error('cardSchedule: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			newLogger.debug('cardSchedule: ' + key + ': ' + message, data);
		}
		else{
			newLogger.debug('cardSchedule: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data){
			newLogger.silly('cardSchedule: ' + key + ': ' + message, data);
		}
		else{
			newLogger.silly('cardSchedule: ' + key + ': ' + message);
		}
	};

};

var processEvent = function(streamEvent, user, repos){
	var streamid = streamEvent.streamid;
	logger.debug(user.username, 'processing event', streamid);

	if(user === undefined){
		logger.debug(user.username, 'no user found');
		return;
	} 

	var condition = {
		userId: user._id,
		date: streamEvent.dateTime.substring(0, 10)
	}

	var objectTags = _(streamEvent.objectTags)
					.map(function(tag){return tag.toLowerCase();})
					.sortBy(function(tag){return tag.toLowerCase();})
					.value();
	var actionTags = _(streamEvent.actionTags)
					.map(function(tag){return tag.toLowerCase();})
					.sortBy(function(tag){return tag.toLowerCase();})
					.value();
	var command = 'schedule.' + objectTags.join(',') + '.' + actionTags.join(',');

	var operation = {
		$set: {
		}
	}

	logger.debug(user.username, 'adding card schedule ', [command, condition.date]);
	operation.$set[command] = true;

	repos.cardSchedule.update(condition, operation, {upsert: true});
};



var cronDaily = function(users, repos){
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.cronDaily = cronDaily;
