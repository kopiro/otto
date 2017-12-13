const TAG = 'IOManager';

const _ = require('underscore');
const queueProcessing = {};

const enabledDrivers = {};
const enabledAccesories = {};

exports.sessionModel = null;

exports.driversCapabilities = {
	telegram: {
		userCanViewUrls: true,
		speechOverGame: false
	},
	messenger: {
		userCanViewUrls: true,
		speechOverGame: false
	},
	kid: {
		userCanViewUrls: false,
		speechOverGame: true
	},
	test: {
		userCanViewUrls: true,
		speechOverGame: true
	},
	api: {
		userCanViewUrls: true,
		speechOverGame: true
	},
};

async function processDriverInputError(driver, { session_model, fulfillment = {} }) {
	console.error('processDriverInputError', 'SID = ' + session_model._id);
	console.dir(fulfillment, { depth: 10 });

	fulfillment = await AI.fulfillmentTransformer(fulfillment, session_model);
	return driver.output(fulfillment, session_model);
}

async function processDriverInput(driver, { session_model, params = {} }) {
	console.info(TAG, 'processDriverInput', 'SID = ' + session_model._id);
	console.dir(params, { depth: 10 });

	// Direct fulfillment
	if (params.fulfillment) {
		return driver.output(params.fulfillment, session_model);
	}

	// Interrogate AI to get fulfillment
	// This invokes API.ai to detect the action and invoke the action to perform fulfillment
	if (params.text) {
		const fulfillment = await AI.textRequest(params.text, session_model);
		return driver.output(fulfillment, session_model);
	}

	if (params.event) {
		const fulfillment = await AI.eventRequest(params.event, session_model);
		return driver.output(fulfillment, session_model);
	}
}

function configureAccessories(driver) {
	for (let accessory of (enabledAccesories[driver.id] || [])) {
		console.info(TAG, `attaching accessory <${accessory.id}> to <${driver.id}>`);
		accessory.attach(driver);
	}
}

function configureDriver(driver) {
	console.info(TAG, `configuring IO Driver <${driver.id}>`);

	let outputDriver = driver;
	if (config.ioRedirectMap[driver.id] != null) {
		const outputDriverStr = config.ioRedirectMap[driver.id];
		console.info(TAG, `<${driver.id}> redirect output to <${outputDriverStr}>`);
		outputDriver = exports.getDriver(outputDriverStr);
	}

	driver.emitter.on('input', async(e) => {
		_.defaults(e, {
			session_model: exports.sessionModel
		});
		
		try {
			if (e.error) throw e.error;
			await processDriverInput(outputDriver, e);
		} catch (ex) {
			e.data = { error: ex };
			await processDriverInputError(outputDriver, e);
		}
	});

	configureAccessories(driver);
	driver.startInput();
}

function isDriverEnabled(e) {
	return (e in enabledDrivers);
}

function loadDrivers() {
	console.info(TAG, 'drivers to load => ' + config.ioDrivers.join(', '));
	for (let driver of config.ioDrivers) {
		enabledDrivers[driver] = exports.getDriver(driver);
	}
}

function loadAccessories() {
	console.info(TAG, 'accesories to load => ', config.ioAccessoriesMap);
	for (let driver of Object.keys(config.ioAccessoriesMap)) {
		const accessories = config.ioAccessoriesMap[driver] || [];
		enabledAccesories[driver] = [];
		for (let accessory of accessories) {
			enabledAccesories[driver].push(exports.getAccessory(accessory));
		}
	}
}

exports.getDriver = function(e) {
	return require(__basedir + '/src/io/' + e);
};

exports.getAccessory = function(e) {
	return require(__basedir + '/src/io_accessories/' + e);
};

exports.output = async function(fulfillment, session_model) {
	session_model = session_model || IOManager.sessionModel;
	fulfillment = await AI.fulfillmentTransformer(fulfillment, session_model);
	console.debug(TAG, 'output', { fulfillment, session_model });
	
	if (isDriverEnabled(session_model.io_id)) {	
		// If driver is enabled, instantly resolve
		let driver = exports.getDriver( session_model.io_id );
		return driver.output(fulfillment, session_model);
	}

	// Otherwise, put in the queue and make resolve to other clients
	console.info(TAG, 'putting in IO queue', { fulfillment, session_model });
	
	(new Data.IOQueue({
		session: session_model._id,
		driver: session_model.io_id,
		fulfillment: fulfillment
	})).save();

	return { 
		inQueue: true 
	};
};

exports.writeLogForSession = async function(sessionId, text) {
	sessionId = sessionId || exports.sessionModel._id;
	return (new Data.SessionInput({ 
		session: sessionId,
		text: text
	})).save();
};

exports.registerSession = async function({ sessionId, io_id, io_data, alias, text, uid }, as_global) {
	const session_id_composite = io_id + '/' + sessionId;
	let session_model = await Data.Session.findOne({ _id: session_id_composite });

	if (session_model == null) {
		session_model = await (new Data.Session({ 
			_id: session_id_composite,
			io_id: io_id,
			io_data: io_data,
			alias: alias,
			uid: uid
		}).save());
	}

	console.info(TAG, 'session model registered', session_model);

	if (text != null) exports.writeLogForSession(session_id_composite, text);
	if (as_global === true) exports.updateGlobalSessionModel(session_model);
	return session_model;
};

exports.updateGlobalSessionModel = function(new_session_model) {
	console.info(TAG, 'updating global session model');
	exports.sessionModel = new_session_model;
};

exports.processQueue = async function() {
	if (exports.sessionModel == null) return;

	let qitem = await Data.IOQueue.findOne({
		session: exports.sessionModel._id,
		driver: { $in: _.keys(enabledDrivers) } 
	}).populate('session');
	if (qitem == null) return;
	if (queueProcessing[qitem._id]) return;

	queueProcessing[qitem._id] = true;

	console.info(TAG, 'processing queue item');
	console.dir(qitem);

	qitem.remove();
	exports.output(qitem.fulfillment, qitem.session);

	return true;
};

exports.startQueuePolling = async function() {
	try {
		exports.processQueue();
	} catch (ex) {
		console.error(TAG, 'queue processing error', ex);
	}
	await timeout(1000);
	exports.startQueuePolling();
};

exports.start = function() {
	loadDrivers();
	loadAccessories();
	for (let key of Object.keys(enabledDrivers)) {
		configureDriver(enabledDrivers[key]);
	}
};
