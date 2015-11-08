'use strict';
var q = require('q');

exports.isFirstSync = function(logger, streamEvent, user, repos){
	return q.Promise(function(resolve, reject){
		logger.silly(user.username, 'checking for whether sync is first one on this stream', {sid: streamEvent.streamid});

		var condition = {
			userId: user._id,
			streamId: streamEvent.streamid,
			objectTags: 'sync',
			actionTags: 'complete'
		};

		repos.userTagIndexes.findOne(condition, function(error, doc){
			if(error){
				logger.error(user.username, 'error occurred retrieving tag index', {error: error});
				reject(error);
				return;
			}

			// eas: the call to save the index from the daily aggregation may not 
			// have made it to the database yet, in which case this will be null.
			if(doc === null){
				resolve(true);
				return;
			}
			else{
				resolve(false);
			}
		});
	});
};