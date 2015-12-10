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
		if(!email.toAddress){
			resolve({message: 'no email to send'});
			return;
		}

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

var getCardsFromDatabase = function(user, repo, from){
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

	return repo.find(query).toArray();
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
		return sendToSendGrid(email, sendGrid);
	});
};

// This treats the first incomplete week of the year 
Date.prototype.getWeek = function() {
	var onejan = new Date(this.getFullYear(),0,1);
	return Math.ceil((((this - onejan) / 86400000) + onejan.getDay()+1)/7);
};

var shouldSendEmail = function(user, now){
	var result = false;
	if(user.emailSettings.cards.frequency === 'daily'){
		result = true;
	} else if(user.emailSettings.cards.frequency === 'weekly'){
		result = now.getDay() === 0;
	}
	else if(user.emailSettings.cards.frequency === 'biweekly'){
		result = (now.getWeek() - 2) % 2 === 0;
	}
	else if(user.emailSettings.cards.frequency === 'fourweekly'){
		result = (now.getWeek() - 2) % 4 === 0;
	}

	return result;
};

module.exports.createEmail = createEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendToSendGrid = sendToSendGrid;
module.exports.setLogger = setLogger;
module.exports.shouldSendEmail = shouldSendEmail;



