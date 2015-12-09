'use strict';

var q = require('Q');

//var _ = require('lodash');
var emailTemplates = require('swig-email-templates');
var userModule = require('./user.js');
var cardFilters = require('./cardFilters.js');

var emailConfigOptions = {
    root: __dirname
};

var logger;
var setLogger = function(newLogger){
	logger = newLogger;
};

module.exports = {};
var createEmail = function(cards, user){
	return q.Promise(function(resolve, reject){
		emailTemplates(emailConfigOptions, function (err, emailRender) {
			if(err){
				reject(err);
				return;
			}

			if(cards.length === 0){
				resolve({});
				return;
			}

			var cardCount = cards.length === 1 ? '1 card' : cards.length + ' cards';

			var context = {
				username: user.username,
				cardCount: cardCount
			};

			emailRender('cardEmailTemplate.eml.html', context, function(renderErr, html){
				if(renderErr){
					reject(renderErr);
					return;
				}

				var result = {
					fromAddress: process.env.ONESELF_EMAIL,
					toAddress: userModule.getEmail(user),
					username: user.username,
					cardCount: cardCount,
					html: html
				};

				resolve(result);
			});
		});	
	});
	
};

var sendToSendGrid = function(email, sendGrid){
	return q.Promise(function(resolve, reject){
		var sendGridEmail = {
			to: email.toAddress,
			from: process.env.ONESELF_EMAIL,
	        subject: email.username + ', ' + email.cardCount + ' are waiting for you',
	        html: email.html
		};
	
		sendGrid.send(sendGridEmail, function (err, response) {
            if (err) {
                logger.error('unable to send cards email', err);
                reject(err);
            } else {
                resolve(response);
            }
        });
	});

};

var getCardsFromDatabase = function(user, cards, from){
	var query = {};
    query.$query = {
        userId: user._id,
        archive: {$ne: true},
        published: true
    };

    if(from){
        query.$query.cardDate = {
            $gt: from
        };
    }

    query.$sort = {
        cardDate: 1
    };

	return cards.find(query).toArray();
};

var sendEmail = function(user, cardsRepo, sendGrid){
	return getCardsFromDatabase(user, cardsRepo)
	.then(function(cards){
		return cardFilters.filterCards(logger, user, user.username, 0.5, undefined, cards, true);
	})
	.then(function(filteredCards){
		return createEmail(filteredCards, user);
	})
	.then(function(email){
		return sendToSendGrid(email, user, sendGrid);
	});
};

module.exports.createEmail = createEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendToSendGrid = sendToSendGrid;
module.exports.setLogger = setLogger;


