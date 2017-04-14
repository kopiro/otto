require('./boot');

IOManager.loadDrivers();
IOManager.startPolling();
	
if (config.cron) {
	require(__basedir + '/cron');
}

if (config.server) {
	require(__basedir + '/server');
}

if (config.awh) {
	require(__basedir + '/awh');
}

function outCognitive(data, image, io) {
	return new Promise((resolve, reject) => {
		const Cognitive = require(__basedir + '/support/cognitive');
		Cognitive.face.detect(image.remoteFile, (err, resp) => {
			if (err) return reject(err);
			if (resp.length === 0) return reject();

			Cognitive.face.identify([ resp[0].faceId ], (err, resp) => {
				if (resp.length === 0 || resp[0] == null || resp[0].candidates.length === 0) return reject(err);
				let person_id = resp[0].candidates[0].personId;

				new ORM.Contact
				.where({ person_id: person_id })
				.fetch({ required: true })
				.then((contact) => {

					const name = contact.get('first_name');
					const responses = [
					`Hey, ciao ${name}!`,
					`Ma... è ${name}`,
					`Da quanto tempo ${name}!, come stai??`
					];

					resolve({ 
						text: responses.getRandom() 
					});
				})
				.catch(reject);
			}); 

		});
	});
}

function successResponse(f, session_model) {
	console.debug('Success', session_model.id, f);

	let io = this;

	io.output(f, session_model)
	.then(io.startInput)
	.catch((err) => {
		console.error('Error in success', err);
		io.startInput();
	});
}

function errorResponse(f, session_model) {
	console.error('Error', session_model.id, f);

	let io = this;

	AI.fulfillmentTransformer(f, session_model)
	.then((f) => {

		io.output(f, session_model)
		.then(io.startInput)
		.catch((err) => {
			console.error('Error in error', err);
			io.startInput();
		});

	});
}

function onIoResponse({ session_model, error, params }) {
	const io = this;

	if (session_model == null) {
		console.error('Invalid session model');
		io.startInput();
		return;
	}

	try {

		console.debug('onIoResponse', 'SID = ' + session_model.id, { error, params });

		if (error) {

			errorResponse.call(io, { 
				data: {
					error: error
				}
			}, session_model);

		} else if (params.text) {

			AI.textRequest(params.text, session_model)
			.then((fulfillment) => { 
				successResponse.call(io, fulfillment, session_model);
			})
			.catch((fulfillment) => {
				console.error('AI error', fulfillment);
				errorResponse.call(io, fulfillment, session_model);
			});

		} else if (params.fulfillment) {

			successResponse.call(io, params.fulfillment, session_model);
		
		} else {
			throw 'Unrecognized type';
		}

	} catch (ex) {
		errorResponse.call(io, { 
			data: {
				error: {
					exception: ex 
				}
			}
		}, session_model);
	}
}

_.each(IOManager.drivers, (io) => {
	io.emitter.on('input', onIoResponse.bind(io));
	io.startInput();
});
