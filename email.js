'use strict';
//var _ = require('lodash');
var q = require('q');
var logger = require('winston');

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

var email = function(){

};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.email = email;
