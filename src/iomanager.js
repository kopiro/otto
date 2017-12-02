const TAG = 'IOManager';

const _ = require('underscore');

exports.drivers = {};
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

exports.isDriverEnabled = function(io_id) {
	return (io_id in exports.drivers);
};

exports.getDriver = function(io_id, force_load) {
	if (force_load) return require(__basedir + '/src/io/' + io_id);
	return exports.drivers[ io_id ] = exports.drivers[ io_id ] || require(__basedir + '/src/io/' + io_id);
};

exports.loadDrivers = function() {
	console.info(TAG, 'drivers to load => ' + config.ioDrivers.join(', '));

	config.ioDrivers.forEach((io_id) => {
		console.debug(TAG, 'loading', io_id);
		exports.drivers[ io_id ] = require(__basedir + '/src/io/' + io_id);
	});
};

exports.output = async function(fulfillment, session_model) {
	session_model = session_model || IOManager.sessionModel;
	fulfillment = await AI.fulfillmentTransformer(fulfillment, session_model);
	
	if (exports.isDriverEnabled(session_model.io_id)) {	
		console.debug(TAG, 'output', { fulfillment, session_model });
		// If driver is enabled, instantly resolve
		let driver = exports.getDriver( session_model.io_id );
		return driver.output(fulfillment, session_model);
	}

	// Otherwise, put in the queue and make resolve to other clients
	console.info(TAG, 'putting in IO queue', { fulfillment, session_model });
	
	new Data.IOQueue({
		session: session_model._id,
		driver: session_model.io_id,
		fulfillment: fulfillment
	}).save();

	return { 
		inQueue: true 
	};
};

exports.writeLogForSession = async function(sessionId, text) {
	return new Data.SessionInput({ 
		session: sessionId,
		text: text
	}).save();
};

exports.registerSession = async function({ sessionId, io_id, io_data, alias, text, uid }, as_global) {
	const session_id_composite = io_id + '/' + sessionId;
	let session_model = await Data.Session.findOne({ _id: session_id_composite });

	if (session_model == null) {
		session_model = await new Data.Session({ 
			_id: session_id_composite,
			io_id: io_id,
			io_data: io_data,
			alias: alias,
			uid: uid
		}).save();
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

let queues_processing = {};

exports.processQueue = async function() {
	if (exports.sessionModel == null) return;

	let qitem = await Data.IOQueue.findOne({
		session: exports.sessionModel._id,
		driver: { $in: _.keys(exports.drivers) } 
	}).populate('session');
	if (qitem == null) return;
	if (queues_processing[qitem._id]) return;

	queues_processing[qitem._id] = true;

	console.info(TAG, 'processing queue item');
	console.dir(qitem);

	qitem.remove();
	exports.output(qitem.fulfillment, qitem.session);

	return true;
};

exports.startPolling = async function() {
	try {
		exports.processQueue();
	} catch (ex) {
		console.error(TAG, 'queue processing error', ex);
	}
	await timeout(1000);
	exports.startPolling();
};
