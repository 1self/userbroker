'use strict';

var assert = require('assert');
var emailMessage = require('../emailMessage.js');

describe('emailMessage', function() {
    it('recognises email all users', function() {
        assert(emailMessage.handle('/email') === true);
    });

    it('processes all users', function() {
    	var message = '/email';
    	var users = {
    		'test1': {
    			username: 'test1',
                emailSettings: {
                    cards: {
                        frequency: 'daily'
                    }
                }
    		}
    	};

        var cardsRepo = {};

        var sendEmail = function(user, repo){
            assert.equal(user.username, 'test1');
            assert.deepEqual(repo, cardsRepo);
        };

        return emailMessage.process(message, users, cardsRepo, sendEmail);

    });

    it('processes specific user', function() {
        var message = '/email/user/test1';
        var users = {
            'test1': {
                username: 'test1',
                emailSettings: {
                    cards: {
                        frequency: 'daily'
                    }
                }
            }
        };

        var cardsRepo = {};

        var sendEmail = function(user, repo){
            assert.equal(user.username, 'test1');
            assert.deepEqual(repo, cardsRepo);
        };

        return emailMessage.process(message, users, cardsRepo, sendEmail);

    });
});