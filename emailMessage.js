'use strict';

var q = require('Q');
var _ = require('lodash');
var emailTemplates = require('swig-email-templates');

var handle = function(message){
	return /^\/email/.test(message);
};

var getNumberOfCards = function(user, cards){
	var query = {
		userId: user._id
	};

	cards.find(query)
}

var sendCardsEmail(user, email, cards){
	return getNumberOfCards(user, cards)
	.then(email.send);
}

var process = function(message, email, users, cards){
	var matches = /^\/email\/user\/([-a-zA-Z0-9]+)$/.exec(message);
	var username = matches[1];
	var result;
	
	if(username){
		sendCardsEmail(users[username]);
	}
	else{
		result = q.Promise();
		_.forEach(users, function(user){
			result.then(email.send(user));
		});
	}

	return result;
};

module.exports = {};
module.exports.handle = handle;
module.exports.process = process;
