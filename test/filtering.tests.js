'use strict';
var assert = require('assert');
var filtering = require('../filtering.js');

describe('tag filtering', function () {
  it('allows browse', function () {
    var objectTags = ['google'];
    var actionTags = ['browse'];
    assert(filtering.tagsAllowed(objectTags, actionTags));
  });

  it('prevents twitter', function () {
    var objectTags = ['internet', 'social-network', 'twitter', 'social-graph', 'inbound', 'follower'];
    var actionTags = ['sample'];
    assert(filtering.tagsAllowed(objectTags, actionTags) === false);
  });
});