var _ = require('lodash');

exports.tagsAllowed = function(objectTags, actionTags){
	var result = true;
	if(_.indexOf(objectTags, 'browse') >= 0){
		result = false;
	}
	return true;
}