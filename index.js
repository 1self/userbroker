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

var mongoUrl = process.env.DBURI;
winston.info('using ' + url.parse(mongoUrl).host);

MongoClient.connect(mongoUrl, function(err, db) {

	console.log('connected to db');
	if(err){
		console.log(err);
	}

	var users = db.collection('users');
	processor.loadUsers(users, function(){
		redisSubscribe.on('message', function(channel, message){
			if(channel === 'events'){
				var event = JSON.parse(message);	
				return;
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
});


// Expose app
//exports = module.exports = app;

module.exports = {};