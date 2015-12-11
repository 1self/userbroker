'use strict';

var assert = require('assert');
var utils = require('../emailMessageUtils.js');
var logger = require('./testlogger.js').logger;

utils.setLogger(logger);

describe('createEmail', function() {
    it('inserts number of cards and username into template', function() {
        process.env.ONESELF_EMAIL = 'testfrom@example.com';

        var cards = [
            {type: 'test'}
        ];

        var user = {
            username: "testuser",
            profile: {
                provider: 'facebook',
                emails: [
                    {value: 'test@example.com'}
                ]
            }

        };

        return utils.createEmail(cards, user)
        .then(function(email){
            assert(/Hi testuser,/.test(email.html));
            assert(/1 card/.test(email.html));
            assert.equal('test@example.com', email.toAddress);
            assert.equal('testuser', email.username);
            assert.equal('1 card', email.cardCount);
        });
        
    });

    it('no cards results in empty html message', function() {
        var cards = [
        ];

        var user = {
            username: "testuser",
            profile: {
                provider: 'facebook',
                emails: [
                    {value: 'test@example.com'}
                ]
            }

        };



        return utils.createEmail(cards, user)
        .then(function(email){
            var expected = {
                username: 'testuser'
            };

            assert.deepEqual(email, expected);
        });
        
    });
});

describe('sendToSendGrid', function() {
    it('collects params and sends', function() {
        var email = {
            fromAddress: 'team@1self.co',
            toAddress: 'test@example.com',
            username: 'testuser',
            html: '<html></html>',
            cardCount: ' 1 card'
        };

        var sendGrid = {
            send: function(sendGridEmail, callback){
                assert.equal(sendGridEmail.to, 'test@example.com');
                assert.equal(sendGridEmail.from, 'testfrom@example.com');
                assert.equal(sendGridEmail.to, 'test@example.com');
                assert.equal(sendGridEmail.to, 'test@example.com');
                callback(null, '');
            }
        };

        return utils.sendToSendGrid(email, sendGrid);
        
    });
});

describe('sendToSendGrid', function() {
    it('doesnt send when email is empty', function() {
        var email = {
        };

        var sendGrid = {
            send: function(sendGridEmail, callback){
                assert(false, 'send shouldn\'t have been called');
                callback(null, '');
            }
        };

        return utils.sendToSendGrid(email, sendGrid);
        
    });
});

describe('shouldSendEmail', function() {
    it('daily', function() {
        var user = {
            emailSettings: {
                cards: {
                    frequency: 'daily'
                }
            }
        };

        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-01"))));
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-02"))));
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-03"))));
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-04"))));
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-05"))));
      
    });

    it('never', function() {
        var user = {
            emailSettings: {
                cards: {
                    frequency: 'never'
                }
            }
        };

        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-01"))) === false);
    });

    it('weekly, beginning of year', function() {
        var user = {
            emailSettings: {
                cards: {
                    frequency: 'weekly'
                }
            }
        };

        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-01"))) === false); // thurs 
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-02"))) === false); // fri
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-03"))) === false); // sat
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-04"))) === true); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-05"))) === false); // mon
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-06"))) === false); // tues
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-07"))) === false); // wed
    });

    it('weekly, end of year', function() {
        var user = {
            emailSettings: {
                cards: {
                    frequency: 'weekly'
                }
            }
        };

        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-25"))) === false); // fri 
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-26"))) === false); // sat
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-27"))) === true); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-28"))) === false); // mon
    });

    it('fourweekly, beginning of year', function() {
        var user = {
            emailSettings: {
                cards: {
                    frequency: 'fourweekly'
                }
            }
        };

        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-01"))) === false); // thurs 
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-02"))) === false); // fri
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-03"))) === false); // sat
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-04"))) === true); // sun 0
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-11"))) === false); // sun 1
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-18"))) === false); // sun 2
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-01-25"))) === false); // sun 3
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-02-02"))) === true); // sun 4
    });

    it('four weekly, end of year', function() {
        var user = {
            emailSettings: {
                cards: {
                    frequency: 'fourweekly'
                }
            }
        };

        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-25"))) === false); // fri 
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-26"))) === false); // sat
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-27"))) === false); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2015-12-28"))) === false); // mon
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2016-01-03"))) === true); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2016-01-10"))) === false); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2016-01-17"))) === false); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2016-01-24"))) === false); // sun
        assert(utils.shouldSendEmail(user, new Date(Date.parse("2016-02-01"))) === true); // sun
    });
});

describe('sendEmail', function() {
    it('collects params and sends', function() {
        var email = {
            fromAddress: 'team@1self.co',
            toAddress: 'test@example.com',
            username: 'testuser',
            html: '<html></html>',
            cardCount: ' 1 card'
        };

        var sendGrid = {
            send: function(sendGridEmail, callback){
                assert.equal(sendGridEmail.to, 'test@example.com');
                assert.equal(sendGridEmail.from, 'testfrom@example.com');
                assert.equal(sendGridEmail.to, 'test@example.com');
                assert.equal(sendGridEmail.to, 'test@example.com');
                callback(null, '');
            }
        };

        return utils.sendToSendGrid(email, sendGrid);
        
    });

   
});