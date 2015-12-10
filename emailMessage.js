'use strict';

var utils = require('./emailMessageUtils.js');
var q = require('Q');
var _ = require('lodash');
var sendGrid = require('sendGrid');

var logger;

var handle = function(message){
	return /^\/email/.test(message);
};



var process = function(message, users, cardsRepo, sendEmail){
	if(!sendEmail){
		sendEmail = utils.sendEmail;
	}

	var result;
	var matches = /^\/email\/user\/([-a-zA-Z0-9]+)$/.exec(message);
	
	if(matches){
		var username = matches[1];
		sendEmail(users[username], cardsRepo, sendGrid);
	}
	else{
		result = q();
		_.forEach(users, function(user){
			if(utils.shouldSendEmail(user, Date.now())){
				result = result.then(sendEmail(user, cardsRepo, sendGrid));
			}
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
