'use strict';
var assert = require('assert');
var utils = require('../eventReplayerUtils.js');

describe('addDateTime', function () {
  it('uses a single date string to set database filter', function () {
    var dateFilter = utils.addDateTime('2016');
    assert(dateFilter.$gte === '2016');
    assert(dateFilter.$lte === '2016Z');
  });

  it('uses a date range to set database filter', function () {
    var dateFilter = utils.addDateTime('2016-01-01T00:00:00.000Z-2016-01-05T12:00:00.000Z');
    assert(dateFilter.$gte === '2016-01-01T00:00:00.000Z');
    assert(dateFilter.$lte === '2016-01-05T12:00:00.000Z');
  });


  
});