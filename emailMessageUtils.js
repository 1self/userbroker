'use strict';

var q = require('q');
var _ = require('lodash');

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

var getEnvironment = function(envVar){
	var result = '';
	if(envVar === 'dev'){
		result = 'DEVELOPMENT';
	}	
	else if(envVar === 'staging'){
		result = 'STAGING';
	}
	
	return result;
};

var getTags = function(cards){
	var tags = {};
	_.forEach(cards, function(c){

		// some cards like the date card don't have\
		// any object tags
		if(c.objectTags === undefined){
			return;
		}

		var cardTags = c.objectTags.concat(c.actionTags);
		var key = cardTags.join(',');
		if(tags[key] === undefined){
			tags[key] = cardTags;
		}
	});
	
	return _.values(tags);
};

var turnTagsIntoHtml = function(tagsCollection){
	var tagsHtml = '<ul>';
	tagsHtml += _.map(tagsCollection, function(tags){
		var result = '<li>';
		result += _.map(tags, function(t){
		    return '<span class=\'tag\'>' + t + '</span>';
		}).join('');
		result += '</li>';
		return result;
	}).join('');
	tagsHtml += '</ul>';
	return tagsHtml;
};

var createEmail = function(cards, user){
	return q.Promise(function(resolve, reject){
		emailTemplates(emailConfigOptions, function (err, emailRender) {
			if(err){
				reject(err);
				return;
			}

			if(cards.length === 0){
				logger.debug(user.username, 'no cards for user, will not send email');
				resolve({username: user.username});
				return;
			}

			var cardCount = cards.length === 1 ? '1 remarkable card' : cards.length + ' remarkable cards';

			var tags = getTags(cards);
			var htmlForTags = turnTagsIntoHtml(tags);
			var context = {
				username: user.username,
				cardCount: cardCount,
				tags: htmlForTags,
				frequency: user.emailSettings.cards.frequency
			};

			logger.silly(user.username, 'rendering email for user', context);

			emailRender('cardEmailTemplate.eml.html', context, function(renderErr, html){
				if(renderErr){
					logger.error(user.username, 'email render error occurred', renderErr);
					reject(renderErr);
					return;
				}

				console.log(html);

				var result = {
					toAddress: userModule.getEmail(user),
					username: user.username,
					cardCount: cardCount,
					html: html,
					environment: getEnvironment(process.env.ENV)
				};

				logger.silly(user.username, 'email created', result);
				resolve(result);
			});
		});	
	});
	
};

var sendToSendGrid = function(email, sendGrid){
	return q.Promise(function(resolve, reject){
		if(!email.toAddress){
			logger.silly(email.username, 'skipping email send');
			resolve({message: 'no email to send'});
			return;
		}

		var sendGridEmail = {
			to: email.toAddress,
			from: process.env.ONESELF_EMAIL,
			fromname: process.env.ONESELF_EMAIL_NAME,
	        subject: email.environment + ' ' + email.username + ', ' + email.cardCount + ' are waiting for you',
	        html: email.html
		};

		logger.silly(email.username, 'sending email to sendgrid', sendGridEmail);
	
		sendGrid.send(sendGridEmail, function (err, response) {
            if (err) {
                logger.error('unable to send cards email', err);
                reject(err);
            } else {
            	logger.info(email.username, 'cards email sent');
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

    logger.silly(user.username, 'querying database for cards', query);
	return repo.find(query).toArray();
};

var sendEmail = function(user, cardsRepo, sendGrid){
	logger.debug(user.username, 'starting the send email process');
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

	logger.silly(user.username, 'should send email', result);

	return result;
};



module.exports.createEmail = createEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendToSendGrid = sendToSendGrid;
module.exports.setLogger = setLogger;
module.exports.shouldSendEmail = shouldSendEmail;
module.exports.getEnvironment = getEnvironment;
module.exports.getTags = getTags;
module.exports.turnTagsIntoHtml = turnTagsIntoHtml;



