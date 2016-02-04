'use strict';

var addDateTime = function(date){
	var result = {
 		$gte: date, 
 		$lte: date + 'Z'
 	};

	if(/(.+Z)-(.+Z)/.test(date)){
		var matches = /(.+Z)-(.+Z)/.exec(date);
		result.$gte = matches[1];
		result.$lte = matches[2];
	}

	return result;
};

module.exports.addDateTime = addDateTime;