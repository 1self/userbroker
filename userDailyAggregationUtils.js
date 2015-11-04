'use strict';

exports.createKey = function(property, propertyKey, MEASURE_DELIMITER){
	var result = [property, propertyKey.replace(/\$|\.|\[|\]/g,function(match){
		if(match === '.'){
			return '^';
		}
		else if (match === '['){
			return '(';
		}
		else if (match === ']'){
			return ')';
		}
		else if (match === '$'){
			return '\uFF04';
		}

		throw 'matched unknown string';
	})].join(MEASURE_DELIMITER);

	return result;
};