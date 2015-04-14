'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';


//var _ = require('lodash');
var logger = require('winston');

var setLogger = function (newLogger){
	logger = newLogger;
};

var processStreamEvent = function(streamEvent){
	logger.info('processed an event', streamEvent);
};

var processUserEvent = function(userEvent){
	logger.info('processed a user event', userEvent);
};

module.exports = {};
module.exports.setLogger = setLogger;
module.exports.processStreamEvent = processStreamEvent;
module.exports.processUserEvent = processUserEvent;