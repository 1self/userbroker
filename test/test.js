'use strict';

// Set up the env vars that userbroker is expecting
process.env.DBURI = 'mongodb://localhost/quantifieddev';
process.env.LOGGINGDIR = '/usr/tmp';
process.env.USERBROKER_CRYPTOKEY = 'test';

var assert = require('assert');
var userbroker = require('../userbroker');
var userDailyAggregation = require('../userDailyAggregation');
var _ = require('lodash');

var logger = {
	messages:{
		verbose: [],
		info: [],
		warn: [],
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

logger.warn = function(message, meta) {
    console.log(message);
    console.log(JSON.stringify(meta));
    logger.messages.warn.push(message);
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
userbroker.setUserRollupRepo(userRollupsRepo);
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

  it('insert index is 0 when array is empty', function () {
  	var index = userDailyAggregation.insertIndex([], 0, function(x){return x;});
    assert(index === 0, 'index is ' + index);
  });

  it('inserts a new top 1', function () {
  	var index = userDailyAggregation.insertIndex([1], 2, function(x){return x;});
    assert(index === 0, 'index is ' + index);
  });

  it('inserts at the end when there is only one entry and it is higher', function () {
  	var index = userDailyAggregation.insertIndex([2], 1, function(x){return x;});
    assert(index === 1, 'index is ' + index);
  });

  it('inserts position 0 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 11, function(x){return x;});
    assert(index === 0, 'index is ' + index);
  });

  it('inserts position 1 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 9, function(x){return x;});
    assert(index === 1, 'index is ' + index);
  });

  it('inserts position 2 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 8, function(x){return x;});
    assert(index === 2, 'index is ' + index);
  });

  it('inserts position 3 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 7, function(x){return x;});
    assert(index === 3, 'index is ' + index);
  });

it('inserts position 4 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 6, function(x){return x;});
    assert(index === 4, 'index is ' + index);
  });

  it('inserts position 5 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 5, function(x){return x;});
    assert(index === 5, 'index is ' + index);
  });

  it('inserts position 6 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 4, function(x){return x;});
    assert(index === 6, 'index is ' + index);
  });

  it('inserts position 7 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 3, function(x){return x;});
    assert(index === 7, 'index is ' + index);
  });

  it('inserts position 8 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 2, function(x){return x;});
    assert(index === 8, 'index is ' + index);
  });

  it('inserts position 9 in a full top 10', function () {
  	var index = userDailyAggregation.insertIndex([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 1, function(x){return x;});
    assert(index === 9, 'index is ' + index);
  });

  it('inserts at the top of equal standing', function () {
  	var index = userDailyAggregation.insertIndex([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 10, function(x){return x;});
    assert(index === 0, 'index is ' + index);
  });

  it('inserts at the top of equal standing 2', function () {
  	var index = userDailyAggregation.insertIndex([10, 10, 10, 10, 10, 9, 9, 9, 9, 9], 9, function(x){return x;});
    assert(index === 5, 'index is ' + index);
  });

  it('inserts at the top of equal standing 2', function () {
  	var index = userDailyAggregation.insertIndex([10, 10, 10, 10, 10, 9, 9, 9, 9, 9], 9, function(x){return x;});
    assert(index === 5, 'index is ' + index);
  });

  it('inserts at the top of equal standing 2', function () {
  	var index = userDailyAggregation.insertIndex([10, 10, 10, 9, 9], 9, function(x){return x;});
    assert(index === 3, 'index is ' + index);
  });

  it('inserts at the end when less than 10 items', function () {
  	var index = userDailyAggregation.insertIndex([10, 10, 10, 9, 9], 8, function(x){return x;});
    assert(index === 5, 'index is ' + index);
  });

  it('simulate filling the top 10 up', function () {
  	var index = userDailyAggregation.insertIndex([], 8, function(x){return x;});
    assert(index === 0, 'index is ' + index);

    index = userDailyAggregation.insertIndex([8], 5, function(x){return x;});
    assert(index === 1, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([8, 5], 10, function(x){return x;});
    assert(index === 0, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([10, 8, 5], 3, function(x){return x;});
    assert(index === 3, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([10, 8, 5, 3], 10, function(x){return x;});
    assert(index === 0, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([10, 10, 8, 5, 3], 9, function(x){return x;});
    assert(index === 2, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([10, 10, 9, 8, 5, 3], 10, function(x){return x;});
    assert(index === 0, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 3], 1, function(x){return x;});
    assert(index === 7, 'index is ' + index);
    
    index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 3, 1], 1, function(x){return x;});
    assert(index === 7, 'index is ' + index);
    
	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 3, 1, 1], 1, function(x){return x;});
    assert(index === 7, 'index is ' + index);
    
	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 3, 1, 1, 1], 5, function(x){return x;});
    assert(index === 5, 'index is ' + index);
    
	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 5, 3, 1, 1], 5, function(x){return x;});
    assert(index === 5, 'index is ' + index);
    
	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 5, 5, 3, 1], 5, function(x){return x;});
    assert(index === 5, 'index is ' + index);

	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 5, 5, 5, 3], 5, function(x){return x;});
    assert(index === 5, 'index is ' + index);

	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 5, 5, 5, 5], 5, function(x){return x;});
    assert(index === 5, 'index is ' + index);

	index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 5, 5, 5, 5], 4, function(x){return x;});
    assert(index === 10, 'index is ' + index);

    index = userDailyAggregation.insertIndex([10, 10, 10, 9, 8, 5, 5, 5, 5, 5], 2, function(x){return x;});
    assert(index === 10, 'index is ' + index);
    
    
  });

 it('negate test', function () {
  	var index = userDailyAggregation.reverseSortedIndex([5], 1, function(x){
  		console.log(-x);
  		return -x;
  	});
    assert(index === 0, 'index is ' + index);
	});

});

