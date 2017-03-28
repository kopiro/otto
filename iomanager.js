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