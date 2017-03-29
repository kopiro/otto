const TAG = "IOManager";

exports.getSessions = function(ioId) {
	return new Memory.Session()
	.query((qb) => {
		qb.where('approved', '=', '1');
		if (config.cron === "debug") {
			qb.where('debug', '=', '1');
		}
	})
	.fetchAll();
};

exports.getAlarmsAt = function(ioId, when) {
	return new Memory.Alarm()
	.query((qb) => {
		qb.join('sessions', 'alarms.session_id', '=', 'sessions.id');
		qb.where('sessions.io_id', '=', ioId);
		qb.where('when', '=', when);
		qb.where('notified', '=', '0');
		qb.where('sessions.approved', '=', '1');
		if (config.cron === "debug") {
			qb.where('sessions.debug', '=', '1');
		}
	})
	.fetchAll();
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
exports.registerSession = function(sessionId, ioId, data, attrs, text) {
	return new Promise((resolve, reject) => {
		let sessionIdComposite = ioId + '/' + sessionId;

		new Memory.Session({ 
			id: sessionIdComposite
		})
		.fetch({ require: true })
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
				io_id: ioId,
				io_data: JSON.stringify(data),
			}))
			.save(null, { method: 'insert' })
			.then(() => {
				exports.writeLogForSession(sessionIdComposite, text);
			});

			reject(session_model);

		});

	});
};