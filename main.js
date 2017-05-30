require('./boot');

IOManager.loadDrivers();
IOManager.startPolling();

if (config.cron) {
	require(__basedir + '/src/cron');
}

if (config.cronvision) {
	require(__basedir + '/src/cronvision');
}

if (config.server) {
	require(__basedir + '/src/server');
}

if (config.awh) {
	require(__basedir + '/src/awh');
}

function successResponse(f, session_model) {
	console.debug('Success', session_model._id, f);
	
	let io = this;
	
	io.output(f, session_model)
	.then(io.startInput)
	.catch((err) => {
		console.error('Error in success', err);
		io.startInput();
	});
}

function errorResponse(f, session_model) {
	console.error('Error', session_model._id, f);
	
	let io = this;
	
	AI.fulfillmentTransformer(f, session_model, (f) => {
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
	
	console.debug('onIoResponse', 'SID = ' + session_model._id, { error, params });
	
	if (error) {
		return errorResponse.call(io, { 
			data: {
				error: error
			}
		}, session_model);
	}
	
	Data.IOPending
	.findOne({ session: session_model._id })
	.then((pending) => {
		
		if (pending != null) {
			
			if (/stop/i.test(params.text)) {
				console.info('Stopping pending action', pending.id);
				
				pending.remove()
				.then(() => {
					AI.fulfillmentTransformer({ speech: 'Ok' }, session_model, (f) => {
						successResponse.call(io, f, session_model);
					});
				});
				return;
			}
			
			console.info('Resolving pending action', pending.id);
			
			pending.remove()
			.then(() => {
				
				const action_fn = Actions.list[ pending.action ];
				AI.fulfillmentPromiseTransformer(action_fn(), {
					sessionId: session_model._id,
					result: _.extend(pending.data, { 
						resolvedQuery: params.text,
					})
				}, session_model, (fulfillment) => {
					successResponse.call(io, fulfillment, session_model);
				});
				
			});
			
			return;
		}
		
		if (params.text) {
			
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
		}
		
	});
}

_.each(IOManager.drivers, (io) => {
	io.emitter.on('input', onIoResponse.bind(io));
	io.startInput();
});