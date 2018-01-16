const TAG = 'IOManager';

const _ = require('underscore');
const queueProcessing = {};

const enabledDrivers = {};
const configuredDriversId = [];

const enabledAccesories = {};

// Constant used when forwarding output to an accessory
exports.CAN_HANDLE_OUTPUT = {
	YES_AND_BREAK: true,
	YES_AND_CONTINUE: true,
	NO: false
};

exports.session = null;

exports.eventToAllIO = function(name, data) {
	for (let k of Object.keys(enabledDrivers)) {
		enabledDrivers[k].emitter.emit(name, data);
	}
};

exports.input = async function({ session, params = {}, fulfillment }) {
	session = session || IOManager.session;
	let driverStr = session.io_driver;

	console.info(TAG, 'input', 'SID = ' + session._id);

	if (false === isIdDriverUp(session.io_id)) {	
		console.info(TAG, 'putting in IO queue', 'SID = ' + session._id);
		new Data.IOQueue({
			io_id: session.io_id,
			session: session._id,
			fulfillment: fulfillment,
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

	const driver = enabledDrivers[driverStr];

	// Only one of those can be fulfilled, in this order
	if (fulfillment) {
		// Direct fulfillment
		fulfillment = await AI.fulfillmentTransformer(fulfillment, session);
		driver.output(fulfillment, session);
	} else if (params.text) {
		// Interrogate AI to get fulfillment by textRequest
		// This invokes API.ai to detect the action and invoke the action to perform fulfillment
		fulfillment = await AI.textRequest(params.text, session);
		driver.output(fulfillment, session);
	} else if (params.event) {
		// Interrogate AI to get fulfillment by eventRequest
		// This invokes API.ai to detect the action and invoke the action to perform fulfillment
		fulfillment = await AI.eventRequest(params.event, session);
		driver.output(fulfillment, session);
	}

	// Process output accessories:
	// An accessory can:
	// - handle a kind of output, process it and blocking the next accessory
	// - handle a kind of output, process it but don't block the next accessory
	// - do not handle and forward to next accessory
	(async() => {
		for (let accessory of (enabledAccesories[driverStr] || [])) {
			let handleType = accessory.canHandleOutput(fulfillment, session);
			switch (handleType) {
				case IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK:
				console.info(TAG, `forwarding output to <${accessory.id}> with YES_AND_BREAK`);
				await accessory.output(fulfillment, session);
				return;
				case IOManager.CAN_HANDLE_OUTPUT.YES_AND_CONTINUE:
				console.info(TAG, `forwarding output to <${accessory.id}> with YES_AND_CONTINUE`);
				await accessory.output(fulfillment, session);
				break;
				case IOManager.CAN_HANDLE_OUTPUT.NO:
				default:
				break;
			}
		}
	})();
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
			e.fulfillment = { data : { error: ex } };
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
		let driver = exports.getDriver(driverStr);

		if (config.serverMode == true && driver.config.noServerMode == true) {
			console.error(TAG, 'unable to load <' + driverStr + '> because this IO is not compatible with server mode');
			continue;
		}

		enabledDrivers[driverStr] = driver;
		configuredDriversId.push(config.uid + '/' + driver.config.id);

		driver.emitter.emit('loaded');
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
