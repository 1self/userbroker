var _ = require('lodash');

exports.generateCardsForRollupProperty = function(objectTags, actionTags, property){
	var result = true;
	if(_.intersection(objectTags, ['stackoverflow', 'instagram', 'foursquare', 'hackernews']).length > 0){
		result = false;
	}
	else if(_.intersection(actionTags, ['browse']).length > 0 && property === '__count__'){
		result = false;
	}
	else if(_.intersection(actionTags, ['sample']).length > 0 && _.intersection(objectTags, ['twitter', 'social-network', 'outbound', 'following']) && property === '__count__'){
		result = false;
	}

	return result;
};