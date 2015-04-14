'use strict';
module.exports = function (str) {
  console.log(str || 'Rainbow');
};

var redis = require('redis');
var processor = require('./processor');
var MongoClient = require('mongodb').MongoClient;
var winston = require('winston');

winston.add(winston.transports.File, { filename: 'proximity.log', level: 'debug', json: false, prettyPrint: true });

winston.error("Errors will be logged here");
winston.warn("Warns will be logged here");
winston.info("Info will be logged here");
winston.debug("Debug will be logged here");

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
	winston.debug("message recieved from channel " + channel);

		switch(channel){
			case 'event':
				var event = JSON.parse(message);	
				processor.processEvent(event, users);
				break;
			case 'users':
				var userMessage = JSON.parse(message);
				processor.processUser(userMessage);
		}
	});
});


// Expose app
//exports = module.exports = app;

module.exports = {};