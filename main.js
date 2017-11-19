require('./boot');

const _ = require('underscore');

async function errorResponse(io, fulfillment, session_model) {
	console.error('ERROR', fulfillment);
	fulfillment = await AI.fulfillmentTransformer(fulfillment, session_model);
	await io.output(fulfillment, session_model);
}

async function onIoResponse(io, { session_model, error, params }) {
	console.debug('onIoResponse', 'SID = ' + session_model._id, { error, params });

	// Instant fulfillment
	if (params.fulfillment) {
		await io.output(params.fulfillment, session_model);
	}
		
	// Interrogate AI to get fulfillment
	// This invokes API.ai to detect the action and
	// invoke the action to perform fulfillment
	if (params.text) {
		const fulfillment = await AI.textRequest(params.text, session_model);
		await io.output(fulfillment, session_model);
	}
}

async function __init__() {
	IOManager.loadDrivers();

	if (config.server) require(__basedir + '/src/server');
	if (config.awh) require(__basedir + '/src/awh');

	mongoose.connectDefault();

	mongoose.connection.on('error', (err) => {
		console.error('Database connection error', err);
	});

	mongoose.connection.once('open', () => {
		console.info('Database connection ok');
		if (config.scheduler) Scheduler.startPolling();
		IOManager.startPolling();
		
		_.each(IOManager.drivers, (io) => {
			io.emitter.on('input', async(e) => {
				try {
					if (e.error) throw e.error;
					await onIoResponse(io, e);
				} catch (ex) {
					await errorResponse(io, { data: { error: ex } }, e.session_model);
				}
			});
			io.startInput();
		});
	});
}

__init__();