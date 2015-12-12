'use strict';

var assert = require('assert');
var utils = require('../emailMessageUtils.js');
var logger = require('./testlogger.js').logger;

utils.setLogger(logger);

describe('createEmail', function() {
    it('inserts number of cards and username into template', function() {
        process.env.ONESELF_EMAIL = 'testfrom@example.com';

        var cards = [
            {
                type: 'test',
                objectTags: ['tag1'],
                actionTags: ['tag2']
            }
        ];

        var user = {
            username: "testuser",
            profile: {
                provider: 'facebook',
                emails: [
                    {value: 'test@example.com'}
                ]
            },
            emailSettings: {
                cards: {
                    frequency: 'daily'
                }
            }

        };

        return utils.createEmail(cards, user)
        .then(function(email){
            assert(/Hi testuser,/.test(email.html));
            assert(/1 remarkable card/.test(email.html));
            assert.equal('test@example.com', email.toAddress);
            assert.equal('testuser', email.username);
            assert.equal('1 remarkable card', email.cardCount);
            assert(/a daily email/, email.frequency);
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

describe('getEnvironment', function() {
    it('live is blank string', function() {
        assert.equal(utils.getEnvironment('prod'), '');
    });

    it('staging is STAGING', function() {
        assert.equal(utils.getEnvironment('staging'), 'STAGING');
    });

    it('dev is DEVELOPMENT', function() {
        assert.equal(utils.getEnvironment('dev'), 'DEVELOPMENT');
    });
});

describe('getTags', function() {
    it('cards without object tags ignored', function() {
        var cards = [
            {
            }
        ];

        assert.deepEqual(utils.getTags(cards).length, 0);
    });

    it('single card gives back tags', function() {
        var cards = [
            {
                objectTags: ['tag1'],
                actionTags: ['tag2']
            }
        ];

        assert.deepEqual(utils.getTags(cards)[0], ['tag1', 'tag2']);
    });

    it('2 cards with same tags gives one tag collection', function() {
        var cards = [
            {
                objectTags: ['tag1'],
                actionTags: ['tag2']
            },
            {
                objectTags: ['tag1'],
                actionTags: ['tag2']
            }

        ];

        assert.equal(utils.getTags(cards).length, 1);
    });

    it('2 cards with different tags gives two tag collections', function() {
        var cards = [
            {
                objectTags: ['tag1'],
                actionTags: ['tag2']
            },
            {
                objectTags: ['tag3'],
                actionTags: ['tag4']
            }

        ];

        assert.equal(utils.getTags(cards).length, 2);
        assert.deepEqual(utils.getTags(cards)[0], ['tag1', 'tag2']);
        assert.deepEqual(utils.getTags(cards)[1], ['tag3', 'tag4']);
    });

    // overlapping tags between two collections are not de-duped
    it('tag collections are identified by all their tags', function() {
        var cards = [
            {
                objectTags: ['tag1'],
                actionTags: ['tag2']
            },
            {
                objectTags: ['tag2'],
                actionTags: ['tag3']
            }
        ];

        assert.equal(utils.getTags(cards).length, 2);
        assert.deepEqual(utils.getTags(cards)[0], ['tag1', 'tag2']);
        assert.deepEqual(utils.getTags(cards)[1], ['tag2', 'tag3']);
    });
});

describe('turnTagsIntoHtml', function() {
    it('empty tags results in empty unordered list', function() {
        var tags = [
        ];

        var actual = utils.turnTagsIntoHtml(tags);
        assert.equal('<ul></ul>', actual);
    });

    it('tags turn to html', function() {
        var tags = [
            ['tag1', 'tag2'],
            ['tag3', 'tag4'],
        ];

        var actual = utils.turnTagsIntoHtml(tags);
        assert.equal('<ul><li><span class=\'tag\'>tag1</span><span class=\'tag\'>tag2</span></li><li><span class=\'tag\'>tag3</span><span class=\'tag\'>tag4</span></li></ul>', actual);
    });
});

