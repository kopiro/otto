let vision = require('@google-cloud/vision');
let visionClient = vision({
	keyFilename: __basedir + '/gcloud.json'
});

module.exports = function() {
	vision.detectLabels('image.jpg', (err, detections, apiResponse) => {
		console.log(labels);
	});
};