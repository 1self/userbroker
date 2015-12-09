'use strict';

var assert = require('assert');
var emailMessage = require('../emailMessage.js');

describe('emailMessage', function() {
    it('recognises email all users', function() {
        assert(emailMessage.handle('/email') === true);
    });

    it('processes all users', function() {
    	var message = '/email';
    	var users = [
    		{
    			username: 'test1',

    		}
    	];

        //emailMessage.process(message, email, users);
        assert(false, 'test to be implemented');
    });
});