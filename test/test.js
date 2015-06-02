'use strict';

// Set up the env vars that userbroker is expecting
process.env.DBURI = 'mongodb://localhost/quantifieddev';
process.env.LOGGINGDIR = '/usr/tmp';

var assert = require('assert');
var userbroker = require('../userbroker');
var userDailyAggregation = require('../userDailyAggregation');
var _ = require('lodash');

var logger = {
	messages:{
		verbose: [],
		info: [],
		warning: [],
		debug: [],
		silly: []
	}
};


logger.verbose = function(message, meta) {
    console.log(message);
    console.log(JSON.stringify(meta));
    logger.messages.verbose.push(message);
};

logger.info = function(message, meta) {
    console.log(message);
    console.log(JSON.stringify(meta));
    logger.messages.info.push(message);
};

logger.warning = function(message, meta) {
    console.log(message);
    console.log(JSON.stringify(meta));
    logger.messages.warning.push(message);
};

logger.debug = function(message, meta) {
    console.log(message);
    console.log(JSON.stringify(meta));
    logger.messages.debug.push(message);
};

logger.silly = function(message, meta) {
    console.log(message);
    console.log(JSON.stringify(meta));
    logger.messages.silly.push(message);
};

userbroker.setLogger(logger);

var users = [
	{
		_id: 1,
		username: 'testuser',
		streams: [
		{ streamid: '1'}
		]
	}
];

var userRepo = {
	find: function(){
		return {
			toArray: function(callback){
				callback(undefined, users);
			}
		};
	},

	findOne: function(){
		return {
			username: 'testuser',
			streams: [
				{
					streamid: 1
				}
			]
		};
	}
};

var userRollupsByDay = {
		events: []
};

var appBrokerRepo = {
		find: function(){
		return {
			toArray: function(callback){
				callback(undefined, [userRollupsByDay]);
			}
		};
	}
};

userbroker.setUserRepo(userRepo);
userbroker.setAppBrokerRepo(appBrokerRepo);
userbroker.loadUsers(userRepo, function(){});

var streamMessage = {
	streamid: '1'
};

describe('userbroker node module', function () {
  it('passes stream event all processing modules', function () {
    userbroker.subscribeMessage('events', JSON.stringify(streamMessage));
    logger.info(JSON.stringify(logger.messages));
    assert(_.contains(logger.messages.debug, 'appBroker: testuser: processing event') === true, 'appBroker didnt get stream event');
    assert(_.contains(logger.messages.debug, 'userDailyAggregation: testuser: processing event') === true);
  });

  it('responds to streams being added to user', function () {
  	var userMessage = {
  		type: 'userupdate',
  		username: 'testuser',
  		streamid: '1'
  	};

    userbroker.subscribeMessage('users', JSON.stringify(userMessage));
    logger.info(logger.messages);
    assert(_.contains(logger.messages.debug, 'userbroker: testuser: mapping 1 to testuser') === true, 'testuser streamid not mapped');
  });

  it('passes cronDaily message to all modules', function () {
  	var message = "cron/daily";

    userbroker.subscribeMessage('userbroker', message);
    logger.info(logger.messages);
    assert(_.contains(logger.messages.info, 'userbroker: cron/daily: asking processor to send users events to apps') === true, 'cron/daily not processed');
    assert(_.contains(logger.messages.info, 'appBroker: cron/daily: received') === true, 'cron/daily not processed');
  });

});

describe('userDailyAggregation node module', function () {

  it('ignores lower and upper case sync events sync events', function () {
  	var event = {
  		objectTags: [],
  		actionTags: ['sync'],
  		dateTime: Date.now()
  	};

    userDailyAggregation.processEvent(event, users[0], userRepo);
    assert(_.contains(logger.messages.debug, 'userDailyAggregation: testuser: ignoring sync event') === true);
  });

  
});

