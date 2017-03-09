const FaceRecognizer = require(__basedir + '/support/facerecognizer');

const NodeWebcam = require('node-webcam');
const im = require('imagemagick');

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

function captureWebcam() {
	if (captureWebcam.time + 10000 <= Date.now()) return;
	
	captureWebcam.time = Date.now();
	let file = __tmpdir + '/webcam' + Date.now();

	NodeWebcam.capture(file, {
		delay: 0,
		quality: 100,
		output: "jpeg",
		verbose: true
	}, (err, image) => {
		if (err) return console.error(TAG, 'Error in capturing webcam');
		const file_resized = file + '-resized.jpg';

		im.resize({
			srcPath: image,
			dstPath: file_resized,
			width: 400
		}, (err, stdout, stderr) => {
			fs.unlinkSync(image);
			if (err) return console.error(TAG, 'Error in resizing image', err);

			const key = config.aws.s3.directory + '/webcam/' + Date.now() + '.jpg';
			s3.putObject({
				Bucket: config.aws.s3.bucket, 
				Key: key, 
				Body: fs.createReadStream(file_resized)
			}, (err) => {
				if (err) return console.error(TAG, 'Error in uploading image', err);

				FaceRecognizer.detect(`http://${config.aws.s3.bucket}.s3.amazonaws.com/${key}`, (err, resp) => {
					if (resp.length === 0) return console.error(TAG, 'Error in detect photo', err);

					FaceRecognizer.identify([ resp[0].faceId ], (err, resp) => {
						if (resp.length === 0 || resp[0] == null || resp[0].candidates.length === 0) return console.error(TAG, 'Error in face detection', err);

						let person_id = resp[0].candidates[0].personId;

						Memory.Contact.where({ person_id: person_id })
						.fetch({ required: true })
						.then((contact) => {
							if (captureWebcam.latestContactId == contact.id) return;
							captureWebcam.latestContactId = contact.id;

							const name = contact.getName();
							const responses = [
							`Hey ${name}, dimmi qualcosa!`,
							`Ciao ${name}, perchè non parli un po' con me?`,
							];

							console.log(responses);

							callback(null, {
								interrupt: true
							}, {
								answer: responses.getRandom()
							});
						})
						.catch(() => {
							const responses = [ `Hey dimmi qualcosa!`, `Ciao perchè non parli un po' con me?`, ];
							callback(null, {
								interrupt: true
							}, {
								answer: responses.getRandom()
							});
						});

					}); 
				}); 
			});
		});
	});
}