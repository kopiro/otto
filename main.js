require('./boot');

const VisionRecognizer = require(__basedir + '/support/visionrecognizer');
const FaceRecognizer = require(__basedir + '/support/facerecognizer');
const Translator = require(__basedir + '/support/translator');

if (config.enableCron) {
	require(__basedir + '/cron');
}

if (config.spawnServerForDataEntry) {
	Memory.spawnServerForDataEntry();
}

let outPhoto = (data, photo) => {
	return new Promise((resolve, reject) => {
		VisionRecognizer.detectLabels(photo.localFile, (err, labels) => {
			if (err) return reject(err);

			if (_.intersection(public_config.faceRecognitionLabels, labels).length > 0) {
				outFace(data, photo)
				.then(resolve)
				.catch((err) => { 
					outVision(data, labels)
					.then(resolve)
					.catch(reject); 
				});
			} else {
				outVision(data, labels)
				.then(resolve)
				.catch(reject); 
			}
		});
	});
};

let outFace = (data, photo) => {
	return new Promise((resolve, reject) => {
		FaceRecognizer.detect(photo.remoteFile, (err, resp) => {
			if (resp.length === 0) return reject(err);

			FaceRecognizer.identify([ resp[0].faceId ], (err, resp) => {
				if (resp.length === 0 || resp[0].candidates.length === 0) return reject(err);

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

					resolve(contact.get('alias_hello') || responses[_.random(0, responses.length-1)]);
				})
				.catch(reject);

			}); 
		}); 
	});
};

let outVision = (data, labels) => {
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

IOs.forEach((io) => {
	io.onInput((err, data, { text, photo }) => {

		try {

			if (text) {
				APIAI.textRequest(data, text)
				.then((resp) => { return io.output(data, resp); })
				.catch((err) => { return io.output(data, err); })
				.then(io.startInput);
			} else if (photo) {
				outPhoto(data, photo)
				.then((resp) => { return io.output(data, resp); })
				.catch((err) => { return io.output(data, err); })
				.then(io.startInput);
			} else {
				io.output(data, { error: 'This input type is not supported yet. Supported: text, photo' })
				.then(io.startInput);
			}

		} catch (ex) {
			console.error(ex);
			io.output(data, { error: ex })
			.then(io.startInput);
		}
	});
	io.startInput();
});