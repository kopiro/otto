const TAG = 'IOManager';

exports.getDriver = function(io_id) {
	return require(__basedir + '/io/' + io_id);
};

exports.output = function(f, session_model) {
	return new Promise((resolve, reject) => {
		AI.fulfillmentTransformer(f, session_model)
		.then((f) => {
			exports.getDriver( session_model.get('io_id') )
			.output(f, session_model)
			.then(resolve)
			.catch(reject);
		})
		.catch((err) => {
			console.error(TAG, 'output', err);
		});
	});
};

exports.getSessions = function(io_id) {
	return new Memory.Session()
	.query((qb) => {
		qb.where('approved', '=', '1');
		if (config.cron === "debug") {
			qb.where('debug', '=', '1');
		}
	})
	.fetchAll();
};

exports.getAlarmsAt = function(io_id, when) {
	return new Memory.Alarm()
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
	if (_.isEmpty(text)) return;
	new Memory.SessionInput({ 
		session_id: sessionId,
		text: text
	}).save();
};

/**
 * Register a new session and write a log for this message
 */
exports.registerSession = function(sessionId, io_id, data, attrs, text) {
	return new Promise((resolve, reject) => {
		let sessionIdComposite = io_id + '/' + sessionId;

		new Memory.Session({ 
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

			let session_model = new Memory.Session(_.extend(attrs || {}, { 
				id: sessionIdComposite,
				io_id: io_id,
				io_data: JSON.stringify(data),
			}))
			.save(null, { method: 'insert' })
			.then(() => {
				exports.writeLogForSession(sessionIdComposite, text);
			})
			.catch((err) => {
				console.error(TAG, 'Unable to register session', err);
			});

			reject(session_model);

		});

	});
};