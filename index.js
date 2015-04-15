'use strict';
module.exports = function (str) {
  console.log(str || 'Rainbow');
};

var redis = require('redis');
var processor = require('./processor');
var MongoClient = require('mongodb').MongoClient;
var winston = require('winston');

winston.add(winston.transports.File, { filename: 'userbroker.log', level: 'debug', json: false, prettyPrint: true });

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

var url = 'mongodb://localhost:27017/quantifieddev';
MongoClient.connect(url, function(err, db) {

	console.log('connected to db');
	if(err){
		console.log(err);
	}

	var users = db.collection('users');

	
	redisSubscribe.on('message', function(channel, message){
		winston.info('change');
		winston.info('message recieved from channel ' + channel);
		winston.info('dddddddd');

		if(channel === 'events'){
			winston.info('doing events');
			winston.info('event message seen', message);
			var event = JSON.parse(message);	
			processor.processStreamEvent(event, users);
		}
		else if(channel === 'users'){
			winston.debug('passing message to user processor');
			var userMessage = JSON.parse(message);
			processor.processUserEvent(userMessage, users);
		}
		else{
			winston.info('unknown event type');
		}

	});
});


// Expose app
//exports = module.exports = app;

module.exports = {};