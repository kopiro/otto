require('./boot');

if (config.enableCron) {
	require('./cron');
}

if (config.spawnServerForDataEntry) {
	Memory.spawnServerForDataEntry();
}

let outPhoto = (data, photo) => {
	VisionRecognizer.detectLabels(photo.localFile, (err, labels) => {
		if (err) return IO.startInput();

		if (_.intersection(public_config.faceRecognitionLabels, labels).length > 0) {
			outFace(data, photo).catch(() => { outVision(data, labels); });
		} else {
			outVision(data, labels);
		}
	});
};

let outFace = (data, photo) => {
	return new Promise((resolve, reject) => {
		FaceRecognizer.detect(photo.remoteFile, (err, resp) => {
			if (resp.length === 0) return reject();

			FaceRecognizer.identify([ resp[0].faceId ], (err, resp) => {
				if (resp.length === 0 || resp[0].candidates.length === 0) return reject();

				let person_id = resp[0].candidates[0].personId;

				Memory.Contact.where({ person_id: person_id }).fetch()
				.then((contact) => {
					const name = contact.get('name');
					const responses = [
					`Hey, ciao ${name}!`,
					`Ma... è ${name}`,
					`Da quanto tempo ${name}!, come stai??`
					];

					IO.output({
						data: data,
						text: contact.get('alias_hello') || responses[_.random(0, responses.length-1)]
					});
				});

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

			IO.output({
				data: data,
				text: responses[_.random(0,responses.length-1)]
			}).then(IO.startInput);
		});
	});
};

IO.onInput(({ sessionId, data, text, photo }) => {

	try {

		if (text) {
			APIAI.textRequest(data, sessionId, text);
		} else if (photo) {
			outPhoto(data, photo);
		} else {
			throw `Input not text, photo`;
		}

	} catch (ex) {
		console.error(ex);
		IO.startInput();
	}
});

IO.startInput();
