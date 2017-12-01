require('./boot');

const _ = require('underscore');

async function onIoErrorResponse(io, { session_model, fulfillment = {} }) {
	console.error('onIoErrorResponse', 'SID = ' + session_model._id, { fulfillment });
	fulfillment = await AI.fulfillmentTransformer(fulfillment, session_model);
	return io.output(fulfillment, session_model);
}

async function onIoResponse(io, { session_model, error, params = {} }) {
	console.debug('onIoResponse', 'SID = ' + session_model._id, { error, params });

	// Instant fulfillment
	if (params.fulfillment) {
		return io.output(params.fulfillment, session_model);
	}
		
	// Interrogate AI to get fulfillment
	// This invokes API.ai to detect the action and
	// invoke the action to perform fulfillment
	if (params.text) {
		const fulfillment = await AI.textRequest(params.text, session_model);
		return io.output(fulfillment, session_model);
	}
}

IOManager.loadDrivers();
mongoose.connectDefault();

if (config.server) require(__basedir + '/src/server');
if (config.awh) require(__basedir + '/src/awh');

mongoose.connection.on('error', (err) => {
	console.error('Database connection error', err);
});

mongoose.connection.once('open', () => {
	console.info('Database connection ok');
	if (config.scheduler) Scheduler.startPolling();
	IOManager.startPolling();

	_.each(IOManager.drivers, (io) => {
		io.emitter.on('input', (e) => {
			try {
				if (e.error) throw e.error;
				onIoResponse(io, e);
			} catch (ex) {
				e.data = { error: ex };
				onIoErrorResponse(io, e);
			}
		});
		io.startInput();
	});
});