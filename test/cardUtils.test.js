'use strict';

var assert = require('assert');
var utils = require('../cardsUtils.js');

describe('isFirstSync', function() {
    it('no sync complete index for the user and stream means it is the first sync', function() {
        var logger = {
            error: function() {},
            silly: function() {}
        };

        var streamEvent = {
            streamid: 1,
        };

        var user = {
            _id: 1,
            username: 'testuser'
        };

        var repos = {
            userTagIndexes: {
                findOne: function(condition, callback) {
                    callback(null, null);
                }
            }
        };

        return utils.isFirstSync(logger, streamEvent, user, repos)
            .then(function(result) {
                assert(result === true);
            });
    });

    it('finding a sync complete index for the user and stream means it isnt the first sync', function() {
        var logger = {
            error: function() {},
            silly: function() {}
        };

        var streamEvent = {
            streamid: 1,
        };

        var user = {
            _id: 1,
            username: 'testuser'
        };

        var repos = {
            userTagIndexes: {
                findOne: function(condition, callback) {
                    callback(null, {});
                }
            }
        };

        return utils.isFirstSync(logger, streamEvent, user, repos)
            .then(function(result) {
                assert(result === false);
            });
    });
});