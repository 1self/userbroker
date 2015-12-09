'use strict';

var utils = require('./emailMessageUtils.js');
var q = require('Q');
var _ = require('lodash');

var logger;

var handle = function(message){
	return /^\/email/.test(message);
};



var process = function(message, users, cardsRepo){
	var matches = /^\/email\/user\/([-a-zA-Z0-9]+)$/.exec(message);
	var username = matches[1];
	var result;
	
	if(username){
		utils.sendCardsEmail(users[username], cardsRepo);
	}
	else{
		result = q.Promise();
		_.forEach(users, function(user){
			result.then(utils.sendEmail(user));
		});
	}

	return result;
};

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	logger.info = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.info('emailMessage: %s: %s, %s', 	key, message, data);
		} 
		else {
			newLogger.info('emailMessage: %s: %s', key, message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.verbose('emailMessage: %s: %s, %s', key, message, data);
		}
		else{
			newLogger.verbose('emailMessage: %s: %s', key, message);
		}
	};

	logger.warn = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.warn('emailMessage: %s: %s, %s', key, message, data);
		} 
		else {
			newLogger.warn('emailMessage: %s: %s', key, message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.error('emailMessage: %s: %s, %s', key, message, data);
		}
		else{
			newLogger.error('emailMessage: %s: %s', key, message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.debug('emailMessage: %s: %s, %s', key, message, data);
		}
		else{
			newLogger.debug('emailMessage: %s: %s', key, message);
		}
	};

	logger.silly = function(key, message, data){
		if(data !== undefined && data !== null){
			newLogger.silly('emailMessage: %s: %s, %s', key, message, data);
		}
		else{
			newLogger.silly('emailMessage: %s: %s', key, message);
		}
	};

};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.handle = handle;
module.exports.process = process;
