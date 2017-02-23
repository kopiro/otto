require('./boot');

if (config.enableCron) {
	require('./cron');
}

Memory.spawnServerForDataEntry();

let AI = require('./ai');

var app = require('apiai')(config.APIAI_TOKEN, {
	language: 'it'
});

let context = {};

let outFace = (data, photo) => {
	return new Promise((resolve, reject) => {
		FaceRecognizer.detect(photo.remoteFile, (err, resp) => {
			if (resp.length === 0) return reject();

			FaceRecognizer.identify([ resp[0].faceId ], (err, resp) => {
				if (resp.length === 0 || resp[0].candidates.length === 0) return reject();

				let person_id = resp[0].candidates[0].personId;

				Memory.Contact.where({ person_id: person_id }).fetch()
				.then((contact) => {
					IO.output({
						data: data,
						text: contact.get('alias_hello') || ('Ma... questo è ' + contact.get('first_name'))
					});
				});

			}); 
		}); 
	});
};

let outVision = (data, labels) => {
	return new Promise((resolve, reject) => {
		Translator.translate(labels[0], 'it', (err, translation) => {
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

	if (text) {

		text = text.replace(AI_NAME_REGEX, '');

		let request = app.textRequest(text, {
			sessionId: sessionId || Date.now()
		});

		request.on('response', function(response) {
			let { result } = response;
			console.debug('API.AI response', JSON.stringify(result, null, 2));

			if (_.isFunction(AI[result.action])) {
				console.info(`Calling AI.${result.action}()`);

				AI[result.action](result)
				.then(function(out) {
					console.info(`Result of AI.${result.action}()`, JSON.stringify(out, null, 2));

					out.data = data;
					IO.output(out).then(IO.startInput);
				})
				.catch(function(err) {
					console.error(`Error in of AI.${result.action}()`, JSON.stringify(err, null, 2));

					err.data = data;
					IO.output(err).then(IO.startInput);
				});

			} else if (result.fulfillment.speech) {
				console.info(`API.AI Direct response = ${result.fulfillment.speech}`);

				let out = {
					text: result.fulfillment.speech
				};
				out.data = data;
				IO.output(out).then(IO.startInput);

			} else {
				console.error(`No strategy found`);
				IO.startInput();
			}

		});

		request.on('error', (err) => {
			context = {};
			console.error('API.AI error', JSON.stringify(err, null, 2));
			IO.output(err).then(IO.startInput);
		});

		request.end();

	} else if (photo) {

		console.info(`Calling VisionRecognizer`);

		VisionRecognizer.detectLabels(photo.localFile, (err, labels) => {
			if (err) return callback({ err: err });

			console.info('VisionRecognizer', labels);

			if (_.intersection([ 'facial expression', 'person', 'face', 'nose', 'hair', 'man', 'human', 'woman' ], labels).length > 0) {
				outFace(data, photo)
				.catch(() => {
					outVision(data, labels);
				});
			} else {
				outVision(data, labels);
			}
		});

	} else {
		console.error(`Input not text,photo`);
		IO.startInput();
	}
});

IO.startInput();
