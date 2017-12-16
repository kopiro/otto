const TAG = 'IOManager';

const _ = require('underscore');
const queueProcessing = {};

const enabledDrivers = {};
const configuredDriversId = [];

const enabledAccesories = {};

exports.session = null;

exports.input = async function({ session, params = {} }) {
	session = session || IOManager.session;
	let driverStr = session.io_driver;

	console.info(TAG, 'input', 'SID = ' + session._id, params);
	console.dir(params, { depth: 10 });

	if (false === isIdDriverUp(session.io_id)) {	
		console.info(TAG, 'putting in IO queue', 'SID = ' + session._id, params);
		new Data.IOQueue({
			io_id: session.io_id,
			session: session._id,
			params: params
		}).save();
		return { 
			inQueue: true 
		};
	}

	if (config.ioRedirectMap[driverStr] != null) {
		driverStr = config.ioRedirectMap[driverStr];
		console.info(TAG, `<${session.io_driver}> redirect output to <${driverStr}>`);
	}

	const driver = exports.getDriver(driverStr);

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

function configureAccessories(driverStr) {
	const driver = enabledDrivers[driverStr];

	for (let accessory of (enabledAccesories[driverStr] || [])) {
		console.info(TAG, `attaching accessory <${accessory.id}> to <${driverStr}>`);
		accessory.attach(driver);
	}
}

function configureDriver(driverStr) {
	console.info(TAG, `configuring IO Driver <${driverStr}>`);

	const driver = enabledDrivers[driverStr];

	driver.emitter.on('input', async(e) => {
		try {
			if (e.error) throw e.error;
			await exports.input(e);
		} catch (ex) {
			e.params = { fulfillment: { data : { error: ex } } };
			await exports.input(e);
		}
	});

	configureAccessories(driverStr);
	driver.startInput();
}

function isIdDriverUp(driverId) {
	return configuredDriversId.indexOf(driverId) >= 0;
}

function loadDrivers() {
	console.info(TAG, 'drivers to load => ' + config.ioDrivers.join(', '));
	for (let driverStr of config.ioDrivers) {
		enabledDrivers[driverStr] = exports.getDriver(driverStr);
		configuredDriversId.push(config.uid + '/' + driverStr);
	}
}

function loadAccessories() {
	console.info(TAG, 'accesories to load => ', Object.keys(config.ioAccessoriesMap).join(', '));
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

exports.writeLogForSession = async function(session, text) {
	return (new Data.SessionInput({ 
		session: session._id,
		text: text
	})).save();
};

exports.getSession = function(sessionIdComposite) {
	return Data.Session.findOne({ _id: sessionIdComposite });
};

exports.registerSession = async function({ sessionId, io_driver, io_data, alias, text }) {
	const io_id = config.uid + '/' + io_driver;
	const sessionIdComposite = io_id + (sessionId == null ? '' : '/' + sessionId);
	let session = await exports.getSession(sessionIdComposite);

	if (session == null) {
		console.info(TAG, 'new session model registered', session);
		session = await (new Data.Session({ 
			_id: sessionIdComposite,
			io_id: io_id,
			io_driver: io_driver,
			io_data: io_data,
			alias: alias,
			settings: config.uid
		}).save());
	}

	if (text != null) exports.writeLogForSession(session, text);
	if (sessionId == null) exports.updateGlobalSession(session);
	return session;
};

exports.updateGlobalSession = function(new_session) {
	console.info(TAG, 'updating global session model');
	exports.session = new_session;
};

exports.processQueue = async function() {
	let qitem = await Data.IOQueue.findOne({
		io_id: { $in: configuredDriversId }
	});
	if (qitem == null) return;
	if (queueProcessing[qitem._id]) return;

	queueProcessing[qitem._id] = true;

	console.info(TAG, 'processing queue item');
	console.dir(qitem, { depth: 10 });

	qitem.remove();
	exports.input(qitem);
};

exports.startQueuePolling = async function() {
	try {
		await exports.processQueue();
	} catch (ex) {
		console.error(TAG, 'queue processing error', ex);
	}
	await timeout(1000);
	exports.startQueuePolling();
};

exports.start = function() {
	loadDrivers();
	loadAccessories();
	for (let driverStr of Object.keys(enabledDrivers)) {
		configureDriver(driverStr);
	}
};
