const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: config.language
});

const Actions = require(__basedir + '/actions');

exports.textRequest = function(data, text, io) {
	return new Promise((resolve, reject) => {
		text = (text || '').replace(AI_NAME_REGEX, '');

		_.defaults(data, {
			sessionId: Date.now()
		});

		let request = apiaiClient.textRequest(text, data);

		request.on('response', (response) => {
			let r = response.result;
			console.debug(TAG, 'response', r);

			if (_.isFunction(Actions[r.action])) {
				console.debug(TAG, `calling ${r.action}()`);

				Actions[r.action](r, io)
				.then((out) => {
					console.debug(TAG, `result of ${r.action}()`, out);
					resolve(out);
				})
				.catch((err) => {
					console.debug(TAG, `error in ${r.action}()`, err);		
					reject(err);
				});

			} else if (r.fulfillment.speech) {
				console.debug(TAG, 'direct response', r.fulfillment.speech);
				resolve({ text: r.fulfillment.speech });
			} else {
				console.error(TAG, `No strategy found`);
				reject({ noStrategy: true });
			}
		});

		request.on('error', (err) => {
			console.error(TAG, 'response error', err);
			reject(err);
		});

		request.end();
	});
};