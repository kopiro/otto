/**
 * URLManager
 * Handle incomings URLs and present to the user based on platform
 */

const TAG = 'URLManager';

const Proc = apprequire('proc');

exports.open = function(url) {
	// TODO: handle errors
	// TODO: handle multiplatform
	return new Promise((resolve, reject) => {
		Proc.spawn('open', [ url ]);
		resolve();
	});
};