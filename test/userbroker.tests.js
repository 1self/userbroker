'use strict';

// Set up the env vars that userbroker is expecting
process.env.DBURI = 'mongodb://localhost/quantifieddev';
process.env.LOGGINGDIR = '/usr/tmp';
process.env.USERBROKER_CRYPTOKEY = 'test';


var assert = require('assert');
var userbroker = require('../userbroker');
var userDailyAggregation = require('../userDailyAggregation');
//var _ = require('lodash');
//var logger = require('winston');

var testLogger = {
	messages:{
		verbose: {},
		info: {},
		warn: {},
		debug: {},
		silly: {},
    	error: {} 
	},

	reset: function(){
		this.messages = {
			verbose: {},
			info: {},
			warn: {},
			debug: {},
			silly: {},
	    	error: {} 
		};
	}
};


var initialiseMessages = function(messages, message){
	if(messages[message] === undefined){
		messages[message] = [];
	}
};

testLogger.verbose = function(message) {
	initialiseMessages(testLogger.messages.verbose, message);
    testLogger.messages.verbose[message].push(arguments);
};

testLogger.info = function(message) {
	initialiseMessages(testLogger.messages.info, message);
    testLogger.messages.info[message].push(arguments);
};

testLogger.warn = function(message) {
	initialiseMessages(testLogger.messages.warn, message);
    testLogger.messages.warn[message].push(arguments);
};

testLogger.debug = function(message) {
	initialiseMessages(testLogger.messages.debug, message);
    testLogger.messages.debug[message].push(arguments);
};

testLogger.silly = function(message) {
    initialiseMessages(testLogger.messages.silly, message);
    testLogger.messages.silly[message].push(arguments);
};

testLogger.error = function(message) {
    initialiseMessages(testLogger.messages.error, message);
    testLogger.messages.error[message].push(arguments);
};

userbroker.setLogger(testLogger);

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

var appBrokerRepo = {
	find: function(){
		return {
			toArray: function(callback){
				callback(undefined, [{events: []}]);
			}
		};
	}
};



var userRollupsRepo = (function(){
	var existingUserRollups = {
		events: []
	};
	var result = {};

	result.updates = [];
	result.find = function(){
		return {
			toArray: function(callback){
				callback(undefined, [existingUserRollups]);
			}
		};
	};

	result.update = function(condition, operation){
		result.updates.push({
			condition: condition,
			operation: operation
		});
	};

	return result;
}());

var cardScheduleRepo = {
	update: function(){

	}
};

var userTagIndexes = {
	update: function(){

	}
};

userbroker.setUserRepo(userRepo);
userbroker.setAppBrokerRepo(appBrokerRepo);
userbroker.setUserRollupRepo(userRollupsRepo);
userbroker.setCardScheduleRepo(cardScheduleRepo);
userbroker.setUserTagIndexesRepo(userTagIndexes);
userbroker.loadUsers(userRepo, function(){});

var streamMessage = {
	streamid: '1',
  dateTime: '2015-06-01T13:00:00.000Z'
};

describe('userbroker node module', function () {
  it('passes stream event to all processing modules', function () {
    userbroker.subscribeMessage('events', JSON.stringify(streamMessage));
    assert(testLogger.messages.debug['cardSchedule: testuser: processing event'] !== undefined);
  });

  it('responds to streams being added to user', function () {
  	var userMessage = {
  		type: 'userupdate',
  		username: 'testuser',
  		streamid: '1'
  	};

    userbroker.subscribeMessage('users', JSON.stringify(userMessage));
    testLogger.info(testLogger.messages);
    assert(testLogger.messages.debug['userbroker: testuser: mapping 1 to testuser'] !== undefined, 'testuser streamid not mapped');
  });

  it('passes cronDaily message to all modules', function () {
  	var message = "cron/daily";

    userbroker.subscribeMessage('userbroker', message);
    assert(testLogger.messages.info['cards: %s: %s'][0][2] === 'cron daily for user', 'cron/daily not processed');
  });

  it('reads the user from the cron daily ', function () {
      var message = "cron/daily/user/testuser/date/2015-01-01";

      userbroker.subscribeMessage('userbroker', message);
      assert(testLogger.messages.debug['cardSchedule: testuser: processing event']);
    });

});

describe('userDailyAggregation node module', function () {
	var repos = {
		userRollupByDay: userRollupsRepo,
		userTagIndexes: userTagIndexes
	};

  it('ignores lower and upper case sync events sync events', function () {
  	testLogger.reset();

  	var event = {
      actionTags: ['start'],
  		objectTags: ['sync'],
  		dateTime: '2015-06-01T13:00:00.000Z'
  	};

    userDailyAggregation.processEvent(event, users[0], repos);
    var logMessages = testLogger.messages.debug['userDailyAggregation: %s: %s'];
    assert(logMessages[1][2] === 'ignoring sync event');
  });

  it('all properties are aggregated', function () {
  	testLogger.reset();

  	var event = {
  		objectTags: ['object'],
  		actionTags: ['action'],
  		properties: {
  			prop1: 10,
  			prop2: 10
  		},
  		dateTime: '2015-06-01T13:00:00.000Z'
  	};


    userDailyAggregation.processEvent(event, users[0], repos);
    testLogger.info('userRollupsRepo updates: ', userRollupsRepo.updates);
    assert(userRollupsRepo.updates[0].condition.userId === 1);
    assert(userRollupsRepo.updates[0].condition.objectTags[0] === 'object');
    assert(userRollupsRepo.updates[0].condition.actionTags[0] === 'action');
    assert(userRollupsRepo.updates[0].operation['$inc']['properties.prop1.13'] === 10);
    assert(userRollupsRepo.updates[0].operation['$inc']['properties.prop2.13'] === 10);
  });

});
