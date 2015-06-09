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

var redisSubscribe = redis.createClient();
redisSubscribe.subscribe('events');
redisSubscribe.subscribe('users');
redisSubscribe.subscribe('userbroker');

var mongoUrl = process.env.DBURI || 'mongodb://localhost/quantifieddev';
logger.info('using ' + url.parse(mongoUrl).host);

MongoClient.connect(mongoUrl, function(err, db) {	

	logger.info('connected to db');
	if(err){
		console.log(err);
	}

	broker.setUserRepo(db.collection('users'));
	broker.setUserRollupRepo(db.collection('userRollupByDay'));
	broker.setAppBrokerRepo(db.collection('appBroker'));
	broker.setIdGenerator(function(){
		return new ObjectID();
	});

	broker.loadUsers(db.collection('users'), function(){
		redisSubscribe.on('message', broker.subscribeMessage);
	});
});
	
module.exports = {};
