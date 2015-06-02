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

	var repos = {
		userRollupByDay: userRollupsRepo
	};

  it('ignores lower and upper case sync events sync events', function () {
  	var event = {
  		objectTags: [],
  		actionTags: ['sync'],
  		dateTime: '2015-06-01T13:00:00.000Z'
  	};

    userDailyAggregation.processEvent(event, users[0], repos);
    assert(_.contains(logger.messages.debug, 'userDailyAggregation: testuser: ignoring sync event') === true);
  });

  it('all properties are aggregated', function () {
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
    logger.info('userRollupsRepo updates: ', userRollupsRepo.updates);
    assert(userRollupsRepo.updates[0].condition.userId === 1);
    assert(userRollupsRepo.updates[0].condition.objectTags[0] === 'object');
    assert(userRollupsRepo.updates[0].condition.actionTags[0] === 'action');
    assert(userRollupsRepo.updates[0].operation['$inc']['properties.prop1.13'] === 10);
    assert(userRollupsRepo.updates[0].operation['$inc']['properties.prop2.13'] === 10);
  });

  
});

