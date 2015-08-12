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
			newLogger.info('eventReplayer: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.info('eventReplayer: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			newLogger.verbose('eventReplayer: ' + key + ': ' + message, data);
		}
		else{
			newLogger.verbose('eventReplayer: ' + key + ': ' + message);
		}
	};

	logger.warn = function(key, message, data){
		if(data){
			newLogger.warn('eventReplayer: ' + key + ': ' + message, data);
		} 
		else {
			newLogger.warn('eventReplayer: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			newLogger.error('eventReplayer: ' + key + ': ' + message, data);
		}
		else{
			newLogger.error('eventReplayer: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			newLogger.debug('eventReplayer: ' + key + ': ' + message, data);
		}
		else{
			newLogger.debug('eventReplayer: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data){
			newLogger.silly('eventReplayer: ' + key + ': ' + message, data);
		}
		else{
			newLogger.silly('eventReplayer: ' + key + ': ' + message);
		}
	};

};

var replayEvents = function(repos, user, date, objectTags, actionTags, eventSink){
	logger.info(user.username, 'replaying events ', date);
	// eas: see http://edsykes.blogspot.com/2015/07/a-text-only-trick-for-retrieving-day.html 
	// for an explanation of why I add Z to the date.
	if(user.streams === undefined){
		logger.info(user.username, 'no streams');
		return;
	}

	var query = {
	 	"payload.streamid": {
	 		$in: user.streams.map(function(stream){return stream.streamid;})
	 	},
	 	"payload.dateTime": {
	 		$gte: date, 
	 		$lte: date + 'Z'
	 	}
	}

	if(objectTags.length > 0){
		query["payload.objectTags"] = {$all: objectTags};
	}

	if(actionTags.length > 0){
		query["payload.actionTags"] = {$all: actionTags};
	}

	repos.eventRepo.find(query).each(function(err, doc){
		if(err){
			logger.error(user, 'error retrieving events', err);
			return;
		}

		if(doc){
			eventSink(doc.payload);
		}
		else if(doc == null){
			logger.info(user.username, 'finished playing back events');
		}
	})
};


module.exports = {};
module.exports.setLogger = setLogger;
module.exports.replayEvents = replayEvents;
