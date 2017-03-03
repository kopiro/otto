require('./boot');

const VisionRecognizer = require(__basedir + '/support/visionrecognizer');
const FaceRecognizer = require(__basedir + '/support/facerecognizer');
const Translator = require(__basedir + '/support/translator');

if (config.cron) {
	require(__basedir + '/cron');
}

if (config.server) {
	require(__basedir + '/server');
}

let outPhoto = (data, photo, io) => {
	if (photo.isFace) return outFace(data, photo, io);

	return new Promise((resolve, reject) => {
		VisionRecognizer.detectLabels(photo.stream || photo.localFile, (err, labels) => {
			if (err) return reject(err);

			if (_.intersection(public_config.faceRecognitionLabels, labels).length > 0) {
				outFace(data, photo, io)
				.then(resolve)
				.catch((err) => { 
					outVision(data, labels)
					.then(resolve)
					.catch(reject); 
				});
			} else {
				outVision(data, labels, io)
				.then(resolve)
				.catch(reject); 
			}
		});
	});
};

let outFace = (data, photo, io) => {
	return new Promise((resolve, reject) => {
		FaceRecognizer.detect(photo.stream || photo.remoteFile, (err, resp) => {
			if (resp.length === 0) return reject(err);

			FaceRecognizer.identify([ resp[0].faceId ], (err, resp) => {
				if (resp.length === 0 || resp[0] == null || resp[0].candidates.length === 0) return reject(err);

				let person_id = resp[0].candidates[0].personId;

				Memory.Contact.where({ person_id: person_id })
				.fetch({ required: true })
				.then((contact) => {
					const name = contact.get('name');
					const responses = [
					`Hey, ciao ${name}!`,
					`Ma... è ${name}`,
					`Da quanto tempo ${name}!, come stai??`
					];

					resolve(responses[_.random(0, responses.length-1)]);
				})
				.catch(reject);

			}); 
		}); 
	});
};

let outVision = (data, labels, io) => {
	return new Promise((resolve, reject) => {
		Translator.translate(labels[0] + ', ' + labels[1], 'it', (err, translation) => {
			if (err) return reject(err);

			let responses = [
			`Uhm... mi sembra di capire che stiamo parlando di ${translation}`,
			`Questo sembra ${translation}`,
			`Aspetta... lo so... è ${translation}`
			];

			resolve(responses[_.random(0,responses.length-1)]);
		});
	});
};

let IOs = [];
config.ioDrivers.forEach((driver) => {
	IOs.push(require(__basedir + '/io/' + driver));
});

function onIoResponse(err, data, para) {
	let io = this;
	para = para || {};

	try {

		if (err) {
			io.output(data, { error: err })
			.then(io.startInput)
			.catch(io.startInput);
		} else {

			if (para.text) {
				APIAI.textRequest(data, para.text, io)
				.then((resp) => { return io.output(data, resp); })
				.catch((err) => { return io.output(data, err); })
				.then(io.startInput);
			} else if (para.photo) {
				outPhoto(data, para.photo, io)
				.then((resp) => { return io.output(data, resp); })
				.catch((err) => { return io.output(data, err); })
				.then(io.startInput);
			} else if (para.answer) {
				io.output(data, para.answer)
				.then(io.startInput);
			} else {
				io.output(data, { error: 'This input type is not supported yet. Supported: text, photo' })
				.then(io.startInput);
			}

		}

	} catch (ex) {

		console.error('Undefined exception', ex);
		io.output(data, { error: ex })
		.then(io.startInput)
		.catch(io.startInput);

	}
}

IOs.forEach((io) => {
	io.startInput();
	io.onInput( onIoResponse.bind(io) );
});