'use strict';
module.exports = function (str) {
  console.log(str || 'Rainbow');
};

var redis = require('redis');
var processor = require('./processor');
var MongoClient = require('mongodb').MongoClient;
var winston = require('winston');
var url = require('url');

winston.add(winston.transports.File, { filename: 'userbroker.log', level: 'debug', json: false, prettyPrint: true });

winston.level = 'info';

winston.info('starting...');	
winston.error("Errors will be logged here");
winston.warn("Warns will be logged here");
winston.info("Info will be logged here");
winston.debug("Debug will be logged here");

process.on('uncaughtException', function(err) {
  winston.error('Caught exception: ' + err);
});

processor.setLogger(winston);

var redisSubscribe = redis.createClient();
redisSubscribe.subscribe('events');
redisSubscribe.subscribe('users');
redisSubscribe.subscribe('userbroker');

var mongoUrl = process.env.DBURI;
winston.info('using ' + url.parse(mongoUrl).host);

var users;

var subscribeMessage = function(channel, message){
	winston.debug(message);
	if(channel === 'events'){
		var event = JSON.parse(message);	
		processor.processStreamEvent(event, users);
	}
	else if(channel === 'users'){
		winston.debug('passing message to user processor');
		var userMessage = JSON.parse(message);
		processor.processUserEvent(userMessage, users);
	}
	else if(channel === 'userbroker'){
		if(message === 'sendEventsToApps'){
			winston.info('asking processor to send users events to apps');
			processor.sendUsersEventsToApps();
		} 
		else if(message.substring(0,7) === 'logging'){
			winston.level = message.split('=')[1];
			winston[winston.level]('logging level set to ' + winston.level);
		}
	}
	else{
		winston.info('unknown event type');
	}
};

MongoClient.connect(mongoUrl, function(err, db) {

	console.log('connected to db');
	if(err){
		console.log(err);
	}

	users = db.collection('users');
	processor.loadUsers(users, function(){
		redisSubscribe.on('message', subscribeMessage);
	});
});


// Expose app
//exports = module.exports = app;

module.exports = {};