require('./boot');

const _ = require('underscore');

async function errorResponse(io, f, session_model) {
	console.error('ERROR', f);
	AI.fulfillmentTransformer(f, session_model, (f) => {
		io.output(f, session_model);
	});
}

async function onIoResponse({ session_model, error, params }) {
	const io = this;
	console.debug('onIoResponse', 'SID = ' + session_model._id, { error, params });
	
	// Instant error fullfillment
	if (error) {
		return errorResponse(io, { data: { error: error } }, session_model);
	}

	// Instant fullfillment
	if (params.fulfillment) {
		return io.output(params.fulfillment, session_model);
	}
		
	// Interrogate AI to get fullfillment
	// This invokes API.ai to detect the action and
	// invoke the action to perform fulfillment
	if (params.text) {
		try {
			const f = await AI.textRequest(params.text, session_model);
			return io.output(f, session_model);
		} catch (err) {
			return errorResponse(io, err, session_model);
		}
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
			io.emitter.on('input', onIoResponse.bind(io));
			io.startInput();
		});
	});
}

__init__();