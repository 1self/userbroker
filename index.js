'use strict';

var redis = require('redis');
var broker = require('./userbroker.js');
var winston = require('winston');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var url = require('url');

var logger = winston;

process.on('uncaughtException', function(err) {
  winston.error('Caught exception: ' + err);
  throw err;
});

var redisClient = redis.createClient();
var redisSubscribe = redis.createClient();
redisSubscribe.subscribe('events');
redisSubscribe.subscribe('users');
redisSubscribe.subscribe('userbroker');

var quantifiedDevUrl = process.env.DBURI || 'mongodb://localhost/quantifieddev';
logger.info('for qd db using ' + url.parse(quantifiedDevUrl).host);

var eventUrl = process.env.EVENTDBURI;
logger.info('for events db using ' + url.parse(eventUrl).host);

MongoClient.connect(quantifiedDevUrl, function(err, qdDb) {	
	logger.info('connected to qdDb');
	if(err){
		console.log(err);
	}

	broker.setUserRepo(qdDb.collection('users'));
	broker.setUserRollupRepo(qdDb.collection('userRollupByDay'));
	broker.setAppBrokerRepo(qdDb.collection('appBroker'));
	broker.setCardsRepo(qdDb.collection('cards'));
	broker.setBulletinRepo(qdDb.collection('bulletin'));
	broker.setCardScheduleRepo(qdDb.collection('cardSchedule'));

	var publishMessage = function(channel, message){
		redisClient.publish('events', message);
	};
	
	broker.setMessagePublisher(publishMessage);

	MongoClient.connect(eventUrl, function(eventErr, eventDb){
		broker.setIdGenerator(function(){
			return new ObjectID();
		});

		broker.setEventRepo(eventDb.collection('oneself'));

		broker.loadUsers(qdDb.collection('users'), function(){
			redisSubscribe.on('message', broker.subscribeMessage);
		});
	});
});
	
module.exports = {};
