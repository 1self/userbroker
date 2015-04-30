'use strict';

var redis = require('redis');
var broker = require('./userbroker.js');
var winston = require('winston');
var MongoClient = require('mongodb').MongoClient;
var url = require('url');
var _ = require('lodash');

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


var loadUsers = function(userRepository, callback){
	logger.info('loading users');
	userRepository.find().toArray(function(error, docs){
		logger.debug('database call complete');
	
		if(error){
			logger.error('error while retrieving all users');
			return;
		}

		logger.info('loaded ' + docs.length + ' users from the database');
		_.map(docs, function(user){
			cacheUser(user);
		});

		callback();	
	});
};

MongoClient.connect(mongoUrl, function(err, db) {	

	logger.info('connected to db');
	if(err){
		console.log(err);
	}

	broker.setUserRepo(db.collection('users'));
	broker.setUserRollupRepo(db.collection('userRollupByDay'));
	broker.loadUsers(db.collection('users'), function(){
		redisSubscribe.on('message', broker.subscribeMessage);
	});
});
	
module.exports = {};
