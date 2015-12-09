'use strict';

var assert = require('assert');
var utils = require('../emailMessageUtils.js');

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

            assert.deepEqual(email, {});
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