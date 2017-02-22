const visionClient = require('@google-cloud/vision')({
	keyFilename: __basedir + '/gcloud.json'
});

const TAG = 'VC';

exports.detectLabels = function(file, callback) {
	visionClient.detectLabels(file, callback);
};