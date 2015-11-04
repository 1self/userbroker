'use strict';
var assert = require('assert');
var filtering = require('../filtering.js');

describe('tag filtering', function () {
  it('allows browse that isnt the count', function () {
    var objectTags = ['google'];
    var actionTags = ['browse'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, 'property'));
  });

  it('prevents browse with inbuilt count', function () {
    var objectTags = ['google'];
    var actionTags = ['browse'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, '__count__') === false);
  });

  it('prevents twitter', function () {
    var objectTags = ['internet', 'social-network', 'twitter', 'social-graph', 'inbound', 'follower'];
    var actionTags = ['sample'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, 'property') === false);
  });

  it('prevents stackoverflow', function () {
    var objectTags = ['internet', 'social-network', 'stackoverflow', 'reputation'];
    var actionTags = ['sample'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, 'property') === false);
  });

  it('prevents instagram', function () {
    var objectTags = ['internet', 'social-network', 'instagram'];
    var actionTags = ['sample'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, 'property') === false);
  });

  it('prevents foursquare', function () {
    var objectTags = ['internet', 'social-network', 'foursquare', 'social-graph', 'inbound', 'follower'];
    var actionTags = ['sample'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, 'property') === false);
  });

  it('prevents hackernews', function () {
    var objectTags = ['internet', 'social-network', 'hackernews'];
    var actionTags = ['sample'];
    assert(filtering.generateCardsForRollupProperty(objectTags, actionTags, 'property') === false);
  });

  
});