'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';


//var _ = require('lodash');
var logger = require('winston');

var setLogger = function (newLogger){
	logger = newLogger;
};

var processEvent = function(userEvent){
	logger.info('received a user event', userEvent);
};

var processUser = function(userMessage){
	logger.info('receied a stream event', userMessage);
};


module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processEvent = processEvent;
module.exports.processUser = processUser;