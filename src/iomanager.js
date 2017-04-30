const TAG = 'IOManager';

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
	return exports.drivers[io_id];
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

		if (session_model == null) {
			return reject('Invalid session model');
		}

		if (exports.isDriverEnabled(session_model.get('io_id'))) {	

			// If driver is enabled, instantly resolve
			AI.fulfillmentTransformer(f, session_model, (f) => {
				exports.getDriver( session_model.get('io_id') )
				.output(f, session_model)
				.then(resolve)
				.catch(reject);
			});

		} else {

			// Otherwise, put in the queue and make resolve to other clients
			console.info(TAG, 'putting in IO queue', session_model.id, f);

			new ORM.IOQueue({
				session_id: session_model.id,
				data: JSON.stringify(f),
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

exports.getSessions = function(io_id) {
	return new ORM.Session()
	.query((qb) => {
		qb.where('approved', '=', '1');
		if (config.cron === "debug") {
			qb.where('debug', '=', '1');
		}
	})
	.fetchAll();
};

exports.getAlarmsAt = function(io_id, when) {
	return new ORM.Alarm()
	.query((qb) => {
		qb.join('sessions', 'alarms.session_id', '=', 'sessions.id');
		qb.where('sessions.io_id', '=', io_id);
		qb.where('when', '=', when);
		qb.where('notified', '=', '0');
		qb.where('sessions.approved', '=', '1');
		if (config.cron === "debug") {
			qb.where('sessions.debug', '=', '1');
		}
	})
	.fetchAll({
		withRelated: ['session']
	});
};

exports.writeLogForSession = function(sessionId, text) {
	setTimeout(() => {
		if (_.isEmpty(text)) return;
		new ORM.SessionInput({ 
			session_id: sessionId,
			text: text
		}).save();
	}, 0);
};

/**
 * Register a new session and write a log for this message
 */
exports.registerSession = function(sessionId, io_id, data, attrs, text) {
	return new Promise((resolve, reject) => {
		let sessionIdComposite = io_id + '/' + sessionId;

		new ORM.Session({ 
			id: sessionIdComposite
		})
		.fetch({
			withRelated: ['contact'],
			require: true 
		})
		.then((session_model) => {

			exports.writeLogForSession(sessionIdComposite, text);

			if (false == session_model.get('approved')) {
				return reject(session_model);
			}

			resolve(session_model);

		})
		.catch((err) => {

			new ORM.Session(_.extend(attrs || {}, { 
				id: sessionIdComposite,
				io_id: io_id,
				io_data: JSON.stringify(data),
			}))
			.save(null, { method: 'insert' })
			.then((session_model) => {
		
				exports.writeLogForSession(sessionIdComposite, text);

				reject(session_model);
		
			})
			.catch((err) => {
				console.error(TAG, 'Unable to register session', err);
			});

		});

	});
};

exports.processQueue = function() {
	ORM.IOQueue
	.find()
	.then((qitems) => {
		if (qitems == null || qitems.length === 0) {
			setTimeout(exports.processQueue, 1000);
			return;
		}

		async.eachOfSeries(qitems.toArray(), (qitem, key, callback) => {
			const session_model = qitem.related('session');

			if (exports.isDriverEnabled( session_model.get('io_id') ) === false) {
				return callback();
			}

			const data = qitem.getData();
			console.info(TAG, 'processing queue item', session_model.id, data);

			exports.output(data, session_model)
			.then(() => {
				qitem.destroy();
			})
			.catch(() => {
			})
			.then(() => {
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
