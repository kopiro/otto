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

function errorResponse(e) {
	let io = this;
	e.error = e.error || {};
	io.output(e)
	.then(io.startInput)
	.catch(io.startInput);
}

function onIoResponse({ error, data, params }) {
	console.info('onIoResponse', { error, data, params });
	let io = this;

	try {

		if (error) {
			throw error;
		}

		if (params.text) {
			AI.textRequest(params.text, data)
			.then((fulfillment) => { 
				io.output({
					fulfillment: fulfillment,
					data: data
				})
				.then(io.startInput)
				.catch(io.startInput); 
			})
			.catch((promise_error) => {
				console.error('Promise error', promise_error);
				errorResponse.call(io, {
					error: promise_error,
					data: data
				});
			});
		} else if (params.fulfillment) {
			io.output({
				fulfillment: params.fulfillment,
				data: data
			})
			.then(io.startInput)
			.catch(io.startInput); 
		}

	} catch (ex) {
		console.error('Unhandled exception', ex);
		errorResponse.call(io, {
			error: ex,
			data: data
		});
	}
}

IOs.forEach((io) => {
	io.emitter.on('input', onIoResponse.bind(io));
	io.startInput();
});
