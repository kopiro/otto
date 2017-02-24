const visionClient = require('@google-cloud/vision')({
	keyFilename: __basedir + '/gcloud.json'
});

const TAG = 'VisionRec';

exports.detectLabels = function(file, callback) {
	visionClient.detectLabels(file, (err, labels) => {
		console.debug(TAG, file, labels);
		callback(err, labels);
	});
};