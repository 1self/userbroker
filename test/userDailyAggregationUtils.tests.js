'use strict';
var assert = require('assert');
var utils = require('../userDailyAggregationUtils.js');

describe('createKey', function () {
  it('dots are turned into carets', function () {
    assert(utils.createKey('property', 'this.that', '.') === 'property.this^that');

  });

  it('square brackets are turned into parenthesis', function () {
    assert(utils.createKey('property', 'this[that]', '.') === 'property.this(that)');
  });

  it('dollar at the beginning of property key is turned into utf 0024', function () {
  	var actual = utils.createKey('property', '$this', '.');
    assert(actual === 'property.\uFF04this', actual);
  });

 it('dollars and dots are escaped', function () {
  	var actual = utils.createKey('property', '$this.that', '.');
    assert(actual === 'property.\uFF04this^that', actual);
  });

});