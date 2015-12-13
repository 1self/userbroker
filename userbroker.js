'use strict';
 
var userDailyAggregation = require('./userDailyAggregation');
var cardSchedule = require('./cardSchedule');
var cards = require('./cards');
var eventReplayer = require('./eventReplayer');
var bulletin = require('./bulletin');
var emailMessage = require('./emailMessage');
var winston = require('winston');
var _ = require('lodash');
var path = require('path');
var assert = require('assert');
var moment = require('moment');
var q = require('q');
require('twix'); // moment plugin
var conceal = require('concealotron');
//var request = require('request');

winston.level = 'error';
winston.info('LOGGINGDIR: ' + process.env.LOGGINGDIR);
assert(process.env.LOGGINGDIR !== undefined);
var loggingLocation = path.join(process.env.LOGGINGDIR, 'userbroker.log');
var errorLog = path.join(process.env.LOGGINGDIR, 'userbroker.error.log');
var warnLog = path.join(process.env.LOGGINGDIR, 'userbroker.warn.log');
winston.info('Setting up logging to ' + loggingLocation);
winston.add(winston.transports.File, { filename: loggingLocation, level: 'debug', json: false, prettyPrint: false });
winston.add(winston.transports.File, { name: 'file#error', filename: errorLog, level: 'error', json: false, prettyPrint: false });
winston.add(winston.transports.File, { name: 'file#warn', filename: warnLog, level: 'warn', json: false, prettyPrint: false });
winston.info('starting...');	
winston.error("Errors will be logged here");
winston.warn("Warns will be logged here");
winston.info("Info will be logged here");
winston.debug("Debug will be logged here");

//var slackChannel = process.env.SLACKCHANNEL;

process.on('uncaughtException', function(err) {
  winston.error('Caught exception: ' + err);
  throw err;
});

var users = {};
var repos = {
	user: {},
	userRollupByDay: {},
	appBroker: {}
};

var messagePublisher = {};

var streamsToUsers = {};

var eventModules = [];
//eventModules.push(appBroker);
eventModules.push(userDailyAggregation);
eventModules.push(cardSchedule);
eventModules.push(cards);

var logger = {};

var setLogger = function(l){
	logger = Object.create(l);
	logger.info = function(key, message, data){
		if(data){
			l.info('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.info('userbroker: ' + key + ': ' + message);
		}
	};

	logger.verbose = function(key, message, data){
		if(data){
			l.verbose('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.verbose('userbroker: ' + key + ': ' + message);
		}
	};
	
	logger.error = function(key, message, data){
		if(data){
			l.error('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.error('userbroker: ' + key + ': ' + message);
		}
	};
	
	logger.debug = function(key, message, data){
		if(data){
			l.debug('userbroker: ' + key + ': ' + message, data);
		}
		else {
			l.debug('userbroker: ' + key + ': ' + message);
		}
	};

	logger.silly = function(key, message, data){
		if(data) {
			l.silly('userbroker: ' + key + ': ' + message, data);
		}
		else
		{
			l.silly('userbroker: ' + key + ': ' + message);
		}
	};

	_.map(eventModules, function(module){
		module.setLogger(l);
	});

	eventReplayer.setLogger(l);
	bulletin.setLogger(l);
	emailMessage.setLogger(l);
};

setLogger(winston);

var yesterday = function(){
	var d = new Date();
	d.setDate(d.getDate() - 1);
	return d.toISOString().substring(0, 10); 
};

var cacheUser = function(user){
	users[user.username] = user;
	_.map(user.streams, function(stream){
		logger.debug(user.username, 'mapping ' + stream.streamid + ' to ' + user.username);
		streamsToUsers[stream.streamid] = user;
	});
	logger.info(user.username, 'mapped ' + user.username + '(' + conceal(user._id) + ') streams');
};

// eas: on any user event we reload the whole user
var processStreamAdd = function(userEvent, userRepository){
	logger.info(userEvent.username, 'loading user into cache', userEvent.username);
	var condition = {
		username: userEvent.username
	};

	// when we go to the database, we leave the node event loop, this means that messages could come 
	// in for the new stream and we wouldn't know they are attached to the user. This means
	// we need to process the attaching stream here. 
	var streamIdAdded = userEvent.streamidAdded;
	if(streamIdAdded){
		streamsToUsers[streamIdAdded] = users[userEvent.username];
		logger.debug(userEvent.username, ["added mapping from ", streamIdAdded].join(''));
	}

	userRepository.findOne(condition, function(error, user){
		if(error){
			logger.error(userEvent.username, 'error while retrieving user', error);
			return;
		}

		if(user.username === undefined){
			logger.warn(userEvent.username, 'user found without a conforming schema, useranme missing: user: ', user);
			return;
		}

		cacheUser(user);
		logger.debug(userEvent.username, 'loaded user from database:', user);
	});
	
	logger.info(userEvent.username, 'processed a user event', userEvent);
};

var cronDailyYesterday = function(module){
	var params = {
		date: yesterday()
	};

	module.cronDaily(users, repos, params);
};

var processEventsChannel = function(message){
	var event = JSON.parse(message);
	var userForStream = streamsToUsers[event.streamid];
	if(userForStream === undefined){
		logger.debug(event.streamid, 'stream doesnt have a user: event, event.streamsToUsers', [event, event.streamsToUsers]);
		return;
	}	

	for (var i = 0; i < eventModules.length; i++) {
		logger.silly(event.streamid, 'calling <proce></proce>ss event');
		eventModules[i].processEvent(event, userForStream, repos);
	}
};

var processUserAdded = function(userEvent, userRepo){
	logger.info(userEvent.username, 'adding user', userEvent.username);

	// first put enough into the user collection that a stream added message can link the
	// two together.
	var newUser = {
		_id: userEvent._id,
		username: userEvent.username
	};

	users[userEvent.username] = newUser;

	var condition = {
		username: userEvent.username
	};



	// Now go and get the whole of the user from the repo
	userRepo.findOne(condition, function(error, user){
		if(error){
			logger.error(userEvent.username, 'error while retrieving user', error);
			return;
		}

		if(user.username === undefined){
			logger.warn(userEvent.username, 'user found without a conforming schema, useranme missing: user: ', user);
			return;
		}

		cacheUser(user);
		logger.debug(userEvent.username, 'loaded user from database:', user);
	});
	
	logger.info(userEvent.username, 'processed a user event', userEvent);
};

var processUsersChannel = function(message){
	var userMessage = JSON.parse(message);

	if(userMessage.type === 'added'){
		processUserAdded(userMessage, repos.user);
	} else {
		processStreamAdd(userMessage, repos.user);
	}
};

var processUserBrokerChannel = function(message){
	var processCronDailyMessageForDateAndTags = function(){
		// date range, object tags, action tags
		var matches = /^cron\/daily\/user\/(.+)\/date\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);
		var cronDailyUser = matches[1];

		var lookedUpUser = users[cronDailyUser];
		if(lookedUpUser === undefined){
			logger.info(cronDailyUser, 'cant initiate unknown user for cron daily', matches);
			return;
		}

		var fromDate = matches[2];
		var toDate = matches[3];

		logger.info(cronDailyUser, 'initiating cron daily', matches);
		logger.debug(cronDailyUser, 'creating date range');
		logger.debug(cronDailyUser, 'creating date array');
		
		var cronDaily = function(){
			var params = {
				objectTags: matches[4].split(","),
				actionTags: matches[5].split(",")
			};
			var nextDate = iter.next();
			var formattedDate = nextDate.format('YYYY-MM-DD');
			params.date = formattedDate;

			logger.info(cronDailyUser, ['cron/daily', formattedDate, 'requesting '].join(': '));
			_.forEach(eventModules, function(module){
				module.cronDaily([lookedUpUser], repos, params);
			});	
		};
		
		var iter = moment(fromDate).twix(toDate, {allDay: true}).iterate("days");
		while(iter.hasNext()){
			cronDaily();
		}
	};

	var processCronDailyMessageForDate = function(){
		var matches = /^cron\/daily\/date\/(\d{4}-\d{2}-\d{2})$/.exec(message);
		var date = matches[1];

		var params = {
			date: date
		};

		logger.info('', ['cron/daily', date, 'requesting '].join(': '));
		_.forEach(eventModules, function(module){
			module.cronDaily(users, repos, params);
		});	
	};

	var processCronDailyMessageForDateRange = function(){
		var matches = /^cron\/daily\/user\/(.+)\/date\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})$/.exec(message);
		var cronDailyUser = matches[1];

		var lookedUpUser = users[cronDailyUser];
		if(lookedUpUser === undefined){
			logger.info(cronDailyUser, 'cant initiate unknown user for cron daily', matches);
			return;
		}

		var fromDate = matches[2];
		var toDate = matches[3];

		logger.info(cronDailyUser, 'initiating cron daily', matches);
		logger.debug(cronDailyUser, 'creating date range');
		var dateRange = moment(fromDate).twix(toDate, {allDay: true});
		logger.debug(cronDailyUser, 'creating date array');
		var iter = dateRange.iterate("days");
		logger.debug(cronDailyUser, 'created date array');

		var callCron = function(){
				var params = {};
				var nextDate = iter.next();
				var formattedDate = nextDate.format('YYYY-MM-DD');
				params.date = formattedDate;

				logger.info(cronDailyUser, ['cron/daily', formattedDate, 'requesting '].join(': '));
				_.forEach(eventModules, function(module){
					module.cronDaily([lookedUpUser], repos, params);
				});	
			};

		while(iter.hasNext()){
			// call cron forces the creation of the params object. Otherwise it will get hoisted and shared
			// between all of the promises
			callCron();
		}
	};

	var processCronDailyMessageForUser = function(){
		var matches = /^cron\/daily\/user\/(.+)$/.exec(message);
		var cronDailyUser = matches[1];
		var lookedUpUser = users[cronDailyUser];
		if(lookedUpUser === undefined){
			logger.info(cronDailyUser, 'cant initiate unknown user for cron daily', matches);
			return;
		}

		var params = {
		};

		var d = new Date();
		d.setDate(d.getDate() - 1);
		params.date = d.toISOString().substring(0, 10); 

		logger.info(cronDailyUser, 'initiating cron daily', matches);
	
		logger.info(cronDailyUser, ['cron/daily', 'requesting '].join(': '));
		_.forEach(eventModules, function(module){
			module.cronDaily([lookedUpUser], repos, params);
		});	
	};

	var processMessageForRecreate = function(){
		// date range, object tags, action tags
		var matches = /^cards\/recreate\/date\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);
		var fromDate = matches[1];
		var toDate = matches[2];

		logger.info('', 'initiating card recreation', matches);
		
		var params = {
				objectTags: matches[3].split(","),
				actionTags: matches[4].split(","),
				from: fromDate,
				to: toDate
		};

		
		var userRecreates = _.map(users, function(user){
			return function(){
				logger.info(user.username, 'requesting card/recreate, params', params);
			    return cards.recreateCardsForTagsAndDateRange(user, repos, params);
			};
		});

		var promise = q();
		userRecreates.forEach(function (f) {
		    promise = promise.then(f);
		});
		
		promise.catch(function(error){
			logger.error(error);
		})
		.done();
	};

	var processEventReplayForDate = function(){
		var matches = /^events\/replay\/date\/(\d{4}-\d{2}-\d{2})$/.exec(message);

		var date = matches[1];
		logger.info(date, 'initiating event replay', {date: date});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		var promises = [];
		_.forEach(users, function(user){
			promises.push(function(){
				return eventReplayer.replayEvents(repos, user, date, [], [], eventSink);
			});
		});
		
		promises.push(function(){
			return q.Promise(function(){
				logger.info(date, 'event replay finished');
			});
		});

		//var promiseSequence = promises.reduce(q.when, q());
		var result = q();
		promises.forEach(function (f) {
		    result = result.then(f);
		});
		
		result.catch(function(error){
			logger.error(error);
		})
		.done();
	};

	var processEventReplayForUserAndYear = function(){
		var matches = /^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4})$/.exec(message);
		var user = matches[1];
		var lookedUpUser = users[user];
		if(lookedUpUser === undefined){
			logger.info(user, 'cant initiate event replay for unknown user', matches);
			return;
		}

		var date = matches[2];
		logger.info(user, 'initiating event replay', {date: date, objectTags: [], actionTags: []});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		eventReplayer.replayEvents(repos, lookedUpUser, date, [], [], eventSink);
	};

	var processEventsReplayForUserAndMonth = function(){
		var matches = /^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2})$/.exec(message);
		var user = matches[1];
		var lookedUpUser = users[user];
		if(lookedUpUser === undefined){
			logger.info(user, 'cant initiate event replay for unknown user', matches);
			return;
		}

		var date = matches[2];
		logger.info(user, 'initiating event replay', {date: date, objectTags: [], actionTags: []});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		eventReplayer.replayEvents(repos, lookedUpUser, date, [], [], eventSink);
	};

	var processEventsReplayForUserAndDay = function(){
		var matches = /^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2}-\d{2})$/.exec(message);
		var user = matches[1];
		var lookedUpUser = users[user];
		if(lookedUpUser === undefined){
			logger.info(user, 'cant initiate event replay for unknown user', matches);
			return;
		}

		var date = matches[2];
		logger.info(user, 'initiating event replay', {date: date, objectTags: [], actionTags: []});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		eventReplayer.replayEvents(repos, lookedUpUser, date, [], [], eventSink);
	};

	var processEventsReplayForUserAndDayAndTags = function(){
		var matches = /^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);
		var user = matches[1];
		var lookedUpUser = users[user];
		if(lookedUpUser === undefined){
			logger.info(user, 'cant initiate event replay for unknown user', matches);
			return;
		}

		var date = matches[2];
		var objectTags = matches[3].split(",");
		var actionTags = matches[4].split(",");
		logger.info(user, 'initiating event replay', {date: date, objectTags: objectTags, actionTags: actionTags});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		eventReplayer.replayEvents(repos, lookedUpUser, date, objectTags, actionTags, eventSink);
	};

	var processEventsReplayForTags = function(){
		var matches = /^events\/replay\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);

		var objectTags = matches[1].split(",");
		var actionTags = matches[2].split(",");
		logger.info('allusers', 'initiating event replay', {objectTags: objectTags, actionTags: actionTags});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};
		
		var date = ''; // setting date to an empty string should ensure that all of the events are brough back

		var promise = q();
		_.forEach(users, function(user){
			promise = promise.then(function(){
				return eventReplayer.replayEvents(repos, user, date, objectTags, actionTags, eventSink);
			});
		});
				
		promise.catch(function(error){
			logger.error(error);
		})
		.done();
	};

	var processEventReplayForObjectTagsActionTagsDate = function(){
		var matches = /^events\/replay\/date\/(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);

		var date = matches[1];
		var objectTags = matches[2].split(",");
		var actionTags = matches[3].split(",");
		logger.info('allusers', 'initiating event replay', {objectTags: objectTags, actionTags: actionTags, date: date});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		var promise = q();
		_.forEach(users, function(user){
			promise = promise.then(function(){
				return eventReplayer.replayEvents(repos, user, date, objectTags, actionTags, eventSink);
			});
		});
				
		promise.catch(function(error){
			logger.error(error);
		})
		.done();
	};

	var processEventsReplayForUserAndMonthAndTags = function(){
		var matches = /^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);
		var user = matches[1];
		var lookedUpUser = users[user];
		if(lookedUpUser === undefined){
			logger.info(user, 'cant initiate event replay for unknown user', matches);
			return;
		}

		var date = matches[2];
		var objectTags = matches[3].split(",");
		var actionTags = matches[4].split(",");
		logger.info(user, 'initiating event replay', {date: date, objectTags: objectTags, actionTags: actionTags});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		eventReplayer.replayEvents(repos, lookedUpUser, date, objectTags, actionTags, eventSink);
	};

	var processEventsReplayForUserAndYearAndTags = function(){
		var matches = /^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4})\/objectTags\/(.+)\/actionTags\/(.+)$/.exec(message);
		var user = matches[1];
		var lookedUpUser = users[user];
		if(lookedUpUser === undefined){
			logger.info(user, 'cant initiate event replay for unknown user', matches);
			return;
		}

		var date = matches[2];
		var objectTags = matches[3].split(",");
		var actionTags = matches[4].split(",");
		logger.info(user, 'initiating event replay', {date: date, objectTags: objectTags, actionTags: actionTags});

		var eventSink = function(event){
			messagePublisher('events', JSON.stringify(event));
		};

		eventReplayer.replayEvents(repos, lookedUpUser, date, objectTags, actionTags, eventSink);
	};

	var processArchiveCardsForDate = function(message){
		var matches = /cards\/archive\/date\/(\d{4}-\d{2}-\d{2})$/.exec(message);
		var date = matches[1];
		var params = {
			date: date
		};
		logger.info(message, 'requesting archive for ', params);
		cards.archive(users, repos, params);
	};

	var processArchiveCards = function(message){
		logger.info(message, 'requesting archive');
		var params = {
			date: yesterday()
		};
		cards.archive(users, repos, params);
	};

	if(message === 'bulletin'){
		logger.info(message, 'asking processor to send bulletin to users');
		bulletin.send(users, repos);
	}
	else if(message === 'cards/archive'){
		processArchiveCards(message);
	}
	else if(/cards\/archive\/date\/(\d{4}-\d{2}-\d{2})$/.test(message)){
		processArchiveCardsForDate(message);
	}
	else if(message === 'cron/daily'){
		logger.info(message, 'asking processor to send users events to apps');
		_.forEach(eventModules, cronDailyYesterday);
	}
	else if(/^cron\/daily\/user\/(.+)\/date\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processCronDailyMessageForDateAndTags();
	} 
	else if(/^cron\/daily\/date\/(\d{4}-\d{2}-\d{2})$/.test(message)){
		processCronDailyMessageForDate();
	} 
	else if(/^cron\/daily\/user\/(.+)\/date\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})$/.test(message)){
		processCronDailyMessageForDateRange();
	}
	else if(/^cron\/daily\/user\/(.+)$/.test(message)){
		processCronDailyMessageForUser();
	}
	else if(/^cards\/recreate\/date\/(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processMessageForRecreate();
	} 
	else if(/^events\/replay\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processEventsReplayForTags();	
	}
	else if(/^events\/replay\/date\/(\d{4}-\d{2}-\d{2})$/.test(message)){
		processEventReplayForDate();
	}
	else if(/^events\/replay\/date\/(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processEventReplayForObjectTagsActionTagsDate();
	}
	else if(/^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4})$/.test(message)){
		processEventReplayForUserAndYear();
	}
	else if(/^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2})$/.test(message)){
		processEventsReplayForUserAndMonth();
	}
	else if(/^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2}-\d{2})$/.test(message)){
		processEventsReplayForUserAndDay();
	}
	else if(/^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processEventsReplayForUserAndDayAndTags();
	}
	else if(/^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4}-\d{2})\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processEventsReplayForUserAndMonthAndTags();
	}
	else if(/^events\/replay\/user\/([-a-zA-Z0-9]+)\/date\/(\d{4})\/objectTags\/(.+)\/actionTags\/(.+)$/.test(message)){
		processEventsReplayForUserAndYearAndTags();
	}
	else if(message.substring(0,7) === 'logging'){
		logger.level = message.split('=')[1];
		logger[logger.level]('userbroker', 'logging level set to ' + logger.level);
	}
	else if(emailMessage.handle(message)){
		emailMessage.processMessage(message, users, repos.cards);
	}
	
};

var channels = {
	events: processEventsChannel,
	users: processUsersChannel,
	userbroker: processUserBrokerChannel
};

var subscribeMessage = function(channel, message){
	logger.info(channel, message);

	var processor = channels[channel];
	if(processor){
		processor(message);
	}
	else{
		logger.info(channel, 'unknown event type');
	}
};

var loadUsers = function(userRepository, callback){
	logger.info('loading users', 'start');
	var projection = {
		username: true,
		streams: true,
		emailSettings: true,
		encodedUsername: true,
		_id: true,
	};

	projection["profile.provider"] = true;
	projection["profile.emails"] = true;

	userRepository.find({}, projection).toArray(function(error, docs){
		logger.debug('loading users', 'database call complete');
	
		if(error){
			logger.error('loading users', 'error while retrieving all users');
			return;
		}

		logger.info('loading users', 'loaded ' + docs.length + ' users from the database');
		_.map(docs, function(user){
			if(user.username === undefined){
				logger.warn('user found without a conforming schema, useranme missing: user: ', user);
				return;
			}
			
			cacheUser(user);
		});

		_.map(eventModules, function(module){
			if(module.start){
				module.start(repos);
			}
		});

		callback();	
	});
};

var setUserRepo = function(userRepo){
	repos.user = userRepo;
};

var setUserTagIndexesRepo = function(repo){
	repos.userTagIndexes = repo;
};

var setCardsRepo = function(repo){
	repos.cards = repo;
};

var setCardScheduleRepo = function(repo){
	repos.cardSchedule = repo;
};

var setUserRollupRepo = function(userRollupRepo){
	repos.userRollupByDay = userRollupRepo;
};

var setBulletinRepo = function(bulletinRepo){
	repos.bulletin = bulletinRepo;
};

var setAppBrokerRepo = function(appBrokerRepo){
	repos.appBroker = appBrokerRepo;
};

var setIdGenerator = function(generator){
	repos.idGenerator = generator;
};

var setEventRepo = function(eventRepo){
	repos.eventRepo = eventRepo;
};

var setMessagePublisher = function(publisher){
	messagePublisher = publisher;
};

module.exports = {};
module.exports.subscribeMessage = subscribeMessage;
module.exports.loadUsers = loadUsers;
module.exports.setLogger = setLogger;
module.exports.setUserRepo = setUserRepo;
module.exports.setUserTagIndexesRepo = setUserTagIndexesRepo;
module.exports.setUserRollupRepo = setUserRollupRepo;
module.exports.setBulletinRepo = setBulletinRepo;
module.exports.setAppBrokerRepo = setAppBrokerRepo;
module.exports.setEventRepo = setEventRepo;
module.exports.setCardsRepo = setCardsRepo;
module.exports.setCardScheduleRepo = setCardScheduleRepo;
module.exports.setIdGenerator = setIdGenerator;
module.exports.setMessagePublisher = setMessagePublisher;	
