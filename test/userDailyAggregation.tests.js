'use strict';
var assert = require('assert');
var utils = require('../userDailyAggregationUtils.js');

describe('createKey', function () {
  it('dots are turned into carets', function () {
    assert(utils.createKey('property', 'this.that', '.') === 'property.this^that');
  });

  it('opening square bracket is turned into opening parenthesis', function () {
    assert(utils.createKey('property', 'this[that', '.') === 'property.this(that');
  });

  it('closing square bracket turned into closing parenthesis', function () {
    assert(utils.createKey('property', 'this]that', '.') === 'property.this)that');
  });

  it('dollar sign at beginning of field is turned into space dollar', function () {
    assert(utils.createKey('property', 'this.that', '.') === 'property.this^that');
  });
});