'use strict';

var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var cardFilters = require('../cardFilters');
var logger = require('./testlogger.js');

describe('cardfilters toDisplay', function () {
  it('filters out bottom 10', function () {
    var result = cardFilters.toDisplay({type: 'bottom10'});
    assert(result === false);
  });

  it('filters out date', function () {
    var result = cardFilters.toDisplay({type: 'date'});
    assert(result === false);
  });

  it('filters in top10', function () {
    var result = cardFilters.toDisplay({type: 'top10'});
    assert(result === true);
  });

  it('filters out read', function () {
    var result = cardFilters.toDisplay({type: 'top10', read: true});
    assert(result === false);
  });
});

describe('cardfilters cardFilter', function () {
  it('single card', function () {
    var cards = [
      { 
        "_id" : new ObjectId("565c89a1915fac784cbb8b06"), 
        "userId" : new ObjectId("5630e6db66bc05e1cd61f85b"), 
        "type" : "top10", 
        "outOf" : 1, 
        "thumbnailMedia" : "chart.html", 
        "startRange" : "2015-03-27", 
        "endRange" : "2015-03-27", 
        "objectTags" : [
            "computer", 
            "git", 
            "github", 
            "software", 
            "source-control"
        ], 
        "actionTags" : [
            "merge"
        ], 
        "position" : 0, 
        "properties" : {
            "sum" : {
                "repo" : {
                    "1self/strava_1self" : {
                        "line-deletions" : 1
                    }
                }
            }
        }, 
        "propertyName" : "line-deletions.sum.repo.1self/strava_1self", 
        "stdDev" : 2.8284271247461903, 
        "correctedStdDev" : 2.8284271247461903, 
        "sampleStdDev" : 0.7071067811865475, 
        "sampleCorrectedStdDev" : 0.7071067811865475, 
        "mean" : 3, 
        "variance" : -2, 
        "value" : 1, 
        "sortingValue" : 1, 
        "cardDate" : "2015-03-27", 
        "generatedDate" : "2015-11-30T17:38:41.952Z", 
        "chart" : "/v1/users/edf/rollups/day/computer,git,github,software,source-control/merge/sum.repo.1self%2Fstrava_1self.line-deletions/.json", 
        "published" : true
      }
    ];

    var username = 'test';
    var user = {
      username: username
    };

    var filtered = cardFilters.filterCards(logger, user, username, 0.5, undefined, cards, false);
    assert.equal(filtered.length, 1);
  });

it('extra filtering hides lower position card', function () {
    var cards = [
      { 
        "_id" : new ObjectId("565c89a1915fac784cbb8b06"), 
        "userId" : new ObjectId("5630e6db66bc05e1cd61f85b"), 
        "type" : "top10", 
        "outOf" : 1, 
        "thumbnailMedia" : "chart.html", 
        "startRange" : "2015-03-27", 
        "endRange" : "2015-03-27", 
        "objectTags" : [
            "computer", 
            "git", 
            "github", 
            "software", 
            "source-control"
        ], 
        "actionTags" : [
            "merge"
        ], 
        "position" : 0, 
        "properties" : {
            "sum" : {
                "repo" : {
                    "1self/strava_1self" : {
                        "line-deletions" : 1
                    }
                }
            }
        }, 
        "propertyName" : "line-deletions.sum.repo.1self/strava_1self", 
        "stdDev" : 2.8284271247461903, 
        "correctedStdDev" : 2.8284271247461903, 
        "sampleStdDev" : 0.7071067811865475, 
        "sampleCorrectedStdDev" : 0.7071067811865475, 
        "mean" : 3, 
        "variance" : -2, 
        "value" : 1, 
        "sortingValue" : 1, 
        "cardDate" : "2015-03-27", 
        "generatedDate" : "2015-11-30T17:38:41.952Z", 
        "chart" : "/v1/users/edf/rollups/day/computer,git,github,software,source-control/merge/sum.repo.1self%2Fstrava_1self.line-deletions/.json", 
        "published" : true
      },
      { 
        "_id" : new ObjectId("565c89a1915fac784cbb8b06"), 
        "userId" : new ObjectId("5630e6db66bc05e1cd61f85b"), 
        "type" : "top10", 
        "outOf" : 1, 
        "thumbnailMedia" : "chart.html", 
        "startRange" : "2015-03-28", 
        "endRange" : "2015-03-28", 
        "objectTags" : [
            "computer", 
            "git", 
            "github", 
            "software", 
            "source-control"
        ], 
        "actionTags" : [
            "merge"
        ], 
        "position" : 1, 
        "properties" : {
            "sum" : {
                "repo" : {
                    "1self/strava_1self" : {
                        "line-deletions" : 1
                    }
                }
            }
        }, 
        "propertyName" : "line-deletions.sum.repo.1self/strava_1self", 
        "stdDev" : 2.8284271247461903, 
        "correctedStdDev" : 2.8284271247461903, 
        "sampleStdDev" : 0.7071067811865475, 
        "sampleCorrectedStdDev" : 0.7071067811865475, 
        "mean" : 3, 
        "variance" : -2, 
        "value" : 1, 
        "sortingValue" : 1, 
        "cardDate" : "2015-03-28", 
        "generatedDate" : "2015-11-30T17:38:41.952Z", 
        "chart" : "/v1/users/edf/rollups/day/computer,git,github,software,source-control/merge/sum.repo.1self%2Fstrava_1self.line-deletions/.json", 
        "published" : true
      }
    ];

    var username = 'test';
    var user = {
      username: username
    };

    var filtered = cardFilters.filterCards(logger, user, username, 0.5, undefined, cards, true);
    assert.equal(filtered.length, 2);
    assert.equal(filtered[1].position, 0);
  });

it('all cards are returned without filtering', function () {
    var cards = [
      { 
        "_id" : new ObjectId("565c89a1915fac784cbb8b06"), 
        "userId" : new ObjectId("5630e6db66bc05e1cd61f85b"), 
        "type" : "top10", 
        "outOf" : 1, 
        "thumbnailMedia" : "chart.html", 
        "startRange" : "2015-03-27", 
        "endRange" : "2015-03-27", 
        "objectTags" : [
            "computer", 
            "git", 
            "github", 
            "software", 
            "source-control"
        ], 
        "actionTags" : [
            "merge"
        ], 
        "position" : 0, 
        "properties" : {
            "sum" : {
                "repo" : {
                    "1self/strava_1self" : {
                        "line-deletions" : 1
                    }
                }
            }
        }, 
        "propertyName" : "line-deletions.sum.repo.1self/strava_1self", 
        "stdDev" : 2.8284271247461903, 
        "correctedStdDev" : 2.8284271247461903, 
        "sampleStdDev" : 0.7071067811865475, 
        "sampleCorrectedStdDev" : 0.7071067811865475, 
        "mean" : 3, 
        "variance" : -2, 
        "value" : 1, 
        "sortingValue" : 1, 
        "cardDate" : "2015-03-27", 
        "generatedDate" : "2015-11-30T17:38:41.952Z", 
        "chart" : "/v1/users/edf/rollups/day/computer,git,github,software,source-control/merge/sum.repo.1self%2Fstrava_1self.line-deletions/.json", 
        "published" : true
      },
      { 
        "_id" : new ObjectId("565c89a1915fac784cbb8b06"), 
        "userId" : new ObjectId("5630e6db66bc05e1cd61f85b"), 
        "type" : "top10", 
        "outOf" : 1, 
        "thumbnailMedia" : "chart.html", 
        "startRange" : "2015-03-28", 
        "endRange" : "2015-03-28", 
        "objectTags" : [
            "computer", 
            "git", 
            "github", 
            "software", 
            "source-control"
        ], 
        "actionTags" : [
            "merge"
        ], 
        "position" : 1, 
        "properties" : {
            "sum" : {
                "repo" : {
                    "1self/strava_1self" : {
                        "line-deletions" : 1
                    }
                }
            }
        }, 
        "propertyName" : "line-deletions.sum.repo.1self/strava_1self", 
        "stdDev" : 2.8284271247461903, 
        "correctedStdDev" : 2.8284271247461903, 
        "sampleStdDev" : 0.7071067811865475, 
        "sampleCorrectedStdDev" : 0.7071067811865475, 
        "mean" : 3, 
        "variance" : -2, 
        "value" : 1, 
        "sortingValue" : 1, 
        "cardDate" : "2015-03-28", 
        "generatedDate" : "2015-11-30T17:38:41.952Z", 
        "chart" : "/v1/users/edf/rollups/day/computer,git,github,software,source-control/merge/sum.repo.1self%2Fstrava_1self.line-deletions/.json", 
        "published" : true
      }
    ];

    var username = 'test';
    var user = {
      username: username
    };

    var filtered = cardFilters.filterCards(logger, user, username, 0.5, undefined, cards, false);
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].position, 0);
    assert.equal(filtered[1].position, 1);
  });

  
});
