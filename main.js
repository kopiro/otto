require('./boot');

console.info('IO: drivers loaded => ' + config.ioDrivers.join(', '));

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

				Memory.Contact
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

let IOs = [];
config.ioDrivers.forEach((driver) => {
	IOs.push(require(__basedir + '/io/' + driver));
});

function successResponse(fulfilment, session_model) {
	console.debug('Success', session_model.id, fulfilment);

	let io = this;

	io.output(fulfilment, session_model)
	.then(io.startInput)
	.catch((err) => {
		console.error('Error in success', err);
		io.startInput();
	});
}

function errorResponse(fulfilment, session_model) {
	console.error('Error', session_model.id, fulfilment);

	let io = this;

	fulfilment.error = fulfilment.error || {};

	io.output(fulfilment, session_model)
	.then(io.startInput)
	.catch((err) => {
		console.error('Error in error', err);
		io.startInput();
	});
}

function onIoResponse({ session_model, error, params }) {
	console.debug('onIoResponse', session_model.id, params);
	let io = this;

	try {

		if (error) {
			errorResponse.call(io, { error: error }, session_model);

		} else if (params.text) {
			AI.textRequest(params.text, session_model)
			.then((fulfillment) => { 
				successResponse.call(io, fulfillment, session_model);
			})
			.catch((aierror) => {
				console.error('AI error', aierror);
				errorResponse.call(io, aierror, session_model);
			});

		} else if (params.fulfillment) {
			successResponse.call(io, params.fulfillment, session_model);
		
		} else {
			throw 'Unrecognized type';
		}

	} catch (ex) {
		errorResponse.call(io, null, session_model);
	}
}

IOs.forEach((io) => {
	io.emitter.on('input', onIoResponse.bind(io));
	io.startInput();
});
