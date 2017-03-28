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

function successResponse(fullfilment, session_model) {
	console.debug('Success', session_model.id, fullfilment);

	let io = this;
	io.output(fullfilment, session_model)
	.then(io.startInput)
	.catch(io.startInput);
}

function errorResponse(fullfilment, session_model) {
	console.error('Error', session_model.id, fullfilment);

	let io = this;
	fullfilment.error = fullfilment.error || {};
	io.output(fullfilment, session_model)
	.then(io.startInput)
	.catch(io.startInput);
}

function onIoResponse({ session_model, error, params }) {
	console.info('onIoResponse', session_model.id, params);
	let io = this;

	try {

		if (error) {
			throw error;
		}

		if (params.text) {
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
		errorResponse.call(io, { error: ex }, session_model);
	}
}

IOs.forEach((io) => {
	io.emitter.on('input', onIoResponse.bind(io));
	io.startInput();
});
