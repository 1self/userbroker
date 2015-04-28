'use strict';
var assert = require('assert');
var userbroker = require('../index');
var _ = require('lodash');

var logger = {
	messages:{
		verbose: [],
		info: [],
		debug: [],
		silly: []
	}
};


logger.verbose = function(message, meta) {
    console.log('code: ' + message);
    console.log('code: ' + JSON.stringify(meta));
    logger.messages.verbose.push(message);
};

logger.info = function(message, meta) {
    console.log('code :' + message);
    console.log('code: ' + JSON.stringify(meta));
    logger.messages.info.push(message);
};

logger.debug = function(message, meta) {
    console.log('code: ' + message);
    console.log('code: ' + JSON.stringify(meta));
    logger.messages.info.push(message);
};

logger.silly = function(message, meta) {
    console.log('code: ' + message);
    console.log('code: ' + JSON.stringify(meta));
    logger.messages.silly.push(message);
};

userbroker.setLogger(logger);

var users = [
	{
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
	}
};

userbroker.loadUsers(userRepo, function(){});

var streamMessage = {
	streamid: '1'
};

process.env.DBURI = 'mongodb://localhost/quantifieddev';

describe('userbroker node module', function () {
  it('all modules get stream event', function () {
    userbroker.subscribeMessage('events', JSON.stringify(streamMessage));
    logger.info(JSON.stringify(logger.messages));
    assert(_.contains(logger.messages.silly, 'appBroker: processing event') === true, 'appBroker didnt get stream event');
    assert(_.contains(logger.messages.silly, 'userDailyAggregation: processing event') === true);
  });
});

