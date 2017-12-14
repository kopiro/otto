const TAG = 'IOManager';

const _ = require('underscore');
const queueProcessing = {};

const enabledDrivers = {};
const enabledAccesories = {};

exports.session = null;

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

exports.input = async function({ session, params = {}, driver }) {
	console.info(TAG, 'input', 'SID = ' + session._id);
	console.dir(params, { depth: 10 });

	session = session || IOManager.session;
	driver = driver || session.getIODriver();

	if (!isDriverEnabled(driver.id)) {	
		console.info(TAG, 'putting in IO queue', { params, session });
		await (new Data.IOQueue({
			session: session._id,
			driver: driver.id,
			data: params
		})).save();
		return { 
			inQueue: true 
		};
	}

	// Direct fulfillment
	if (params.fulfillment) {
		params.fulfillment = await AI.fulfillmentTransformer(params.fulfillment, session);
		return driver.output(params.fulfillment, session);
	}

	// Interrogate AI to get fulfillment
	// This invokes API.ai to detect the action and invoke the action to perform fulfillment
	if (params.text) {
		const fulfillment = await AI.textRequest(params.text, session);
		return driver.output(fulfillment, session);
	}

	if (params.event) {
		const fulfillment = await AI.eventRequest(params.event, session);
		return driver.output(fulfillment, session);
	}
};

function configureAccessories(driver) {
	for (let accessory of (enabledAccesories[driver.id] || [])) {
		console.info(TAG, `attaching accessory <${accessory.id}> to <${driver.id}>`);
		accessory.attach(driver);
	}
}

function configureDriver(driver) {
	console.info(TAG, `configuring IO Driver <${driver.id}>`);

	let driverOverride = null;
	if (config.ioRedirectMap[driver.id] != null) {
		const outputDriverStr = config.ioRedirectMap[driver.id];
		console.info(TAG, `<${driver.id}> redirect output to <${outputDriverStr}>`);
		driverOverride = exports.getDriver(outputDriverStr);
	}

	driver.emitter.on('input', async(e) => {
		_.defaults(e, {
			driver: driverOverride,
			session: exports.session
		});
		
		try {
			if (e.error) throw e.error;
			await exports.input(e);
		} catch (ex) {
			e.params = { fulfillment: { data : { error: ex } } };
			await exports.input(e);
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

exports.writeLogForSession = async function(sessionId, text) {
	sessionId = sessionId || exports.session._id;
	return (new Data.SessionInput({ 
		session: sessionId,
		text: text
	})).save();
};

exports.registerSession = async function({ sessionId, io_id, io_data, alias, text, uid }, as_global) {
	const session_id_composite = io_id + '/' + sessionId;
	let session = await Data.Session.findOne({ _id: session_id_composite });

	if (session == null) {
		session = await (new Data.Session({ 
			_id: session_id_composite,
			io_id: io_id,
			io_data: io_data,
			alias: alias,
			uid: uid
		}).save());
	}

	console.info(TAG, 'session model registered', session);

	if (text != null) exports.writeLogForSession(session_id_composite, text);
	if (as_global === true) exports.updateGlobalSession(session);
	return session;
};

exports.updateGlobalSession = function(new_session) {
	console.info(TAG, 'updating global session model');
	exports.session = new_session;
};

exports.processQueue = async function() {
	if (exports.session == null) return;

	let qitem = await Data.IOQueue.findOne({
		session: exports.session._id,
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
