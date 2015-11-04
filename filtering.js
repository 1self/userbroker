var _ = require('lodash');

exports.generateCardsForRollupProperty = function(objectTags, actionTags, property){
	var result = true;
	if(_.intersection(objectTags, ['twitter', 'stackoverflow', 'instagram', 'foursquare', 'hackernews']).length > 0){
		result = false;
	}
	else if(_.intersection(actionTags, ['browse']).length > 0 && property === '__count__'){
		result = false;
	}

	return result;
}