const TAG = 'IOManager';

const _ = require('underscore');
const async = require('async');

exports.drivers = {};

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

exports.output = function(f, session_model) {
	return new Promise((resolve, reject) => {

		if (exports.isDriverEnabled(session_model.io_id)) {	

			// If driver is enabled, instantly resolve
			AI.fulfillmentTransformer(f, session_model, async(f) => {
				let driver = exports.getDriver( session_model.io_id );
				let result = await driver.output(f, session_model);
				resolve(result);
			});

		} else {

			// Otherwise, put in the queue and make resolve to other clients
			console.info(TAG, 'putting in IO queue', session_model._id, f);

			new Data.IOQueue({
				session: session_model._id,
				data: f
			})
			.save()
			.then(() => {
				resolve({
					inQueue: true
				});
			})
			.catch((err) => {
				console.error(TAG, 'in queue', err);
				reject(err);
			});

		}
	});
};

exports.getAlarmsAt = function(when) {
	return new Promise((resolve, reject) => {
		resolve([]);
	});
};

exports.writeLogForSession = function(sessionId, text) {
	if (_.isEmpty(text)) return;
	new Data.SessionInput({ 
		session: sessionId,
		text: text
	}).save();
};

exports.registerSession = function({ sessionId, io_id, io_data, alias, text }) {
	return new Promise((resolve, reject) => {
		let sessionIdComposite = io_id + '/' + sessionId;

		Data.Session
		.findOne({ _id: sessionIdComposite })
		.then((session_model) => {
			if (session_model == null) {
				new Data.Session({ 
					_id: sessionIdComposite,
					io_id: io_id,
					io_data: io_data,
					alias: alias
				})
				.save()
				.then((session_model) => {
					if (text) exports.writeLogForSession(sessionIdComposite, text);
					resolve(session_model);
				})
				.catch((err) => {
					console.error(TAG, 'Unable to register session', err);
				});
			} else {
				if (text) exports.writeLogForSession(sessionIdComposite, text);
				resolve(session_model);
			}
		})
		.catch((err) => {
			console.error(TAG, 'Register session', err);
		});
	});
};

exports.processQueue = function() {
	Data.IOQueue
	.find()
	.populate('session')
	.then((qitems) => {
		if (qitems == null || qitems.length === 0) {
			setTimeout(exports.processQueue, 1000);
			return;
		}

		async.eachOfSeries(qitems, (qitem, key, callback) => {
			const session_model = qitem.session;

			if (exports.isDriverEnabled( session_model.io_id ) === false) {
				return callback();
			}

			console.info(TAG, 'processing queue item', session_model._id, qitem.data);

			exports.output(qitem.data, session_model)
			.then(() => {
			})
			.catch(() => {
			})
			.then(() => {
				qitem.remove();
				callback();
			});

		}, () => {
			setTimeout(exports.processQueue, 1000);
		});
	});
};

exports.startPolling = function() {
	exports.processQueue();
};

exports.processResponseToPendingAnswer = function(dataset, q, attr) {
	attr = attr || 'title';
	return _.find(dataset, (e, index) => {
		return (cleanText(e[attr]) === cleanText(q)) || ((index+1) === q);
	});
};
