'use strict';

var utils = require('./emailMessageUtils.js');
var q = require('q');
var _ = require('lodash');
var sendGrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

var logger;

var handle = function(message){
	return /^\/email/.test(message);
};



var processMessage = function(message, users, cardsRepo, sendEmail){
	logger.info('processing email send request');
	if(!sendEmail){
		sendEmail = utils.sendEmail;
	}

	var result;
	var matches = /^\/email\/user\/([-a-zA-Z0-9]+)$/.exec(message);
	
	if(matches){
		logger.debug('sending email to individual user');
		var username = matches[1];
		sendEmail(users[username], cardsRepo, sendGrid);
	}
	else{
		logger.debug('sending email to all users');
		result = q();
		_.forEach(users, function(user){
			if(utils.shouldSendEmail(user, new Date())){
				result = result.then(function(){
					return sendEmail(user, cardsRepo, sendGrid);
				});
			}
		});
	}

	return result;
};

var setLogger = function (newLogger){
	logger = Object.create(newLogger);
	utils.setLogger(logger);
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
module.exports.processMessage = processMessage;
