const TAG = 'API.AI';

let apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: config.language
});

let Actions = require(__basedir + '/actions');

exports.textRequest = function(data, text) {
	return new Promise((resolve, reject) => {
		text = text.replace(AI_NAME_REGEX, '');

		_.defaults(data, {
			sessionId: Date.now()
		});

		let request = apiaiClient.textRequest(text, data);

		request.on('response', function(response) {
			let r = response.result;
			console.debug(TAG, 'response', r);

			if (_.isFunction(Actions[r.action])) {
				console.info(TAG, `calling ${r.action}()`);

				Actions[r.action](r)
				.then(function(out) {
					console.info(TAG, `result of ${r.action}()`, out);
					resolve(out);
				})
				.catch(function(err) {
					console.error(TAG, `error in ${r.action}()`, err);		
					reject(err);
				});

			} else if (r.fulfillment.speech) {
				console.info(TAG, 'direct response', r.fulfillment.speech);
				resolve({ text: r.fulfillment.speech });
			} else {
				console.error(TAG, `No strategy found`);
				reject({ error: 'No strategy found' });
			}

		});

		request.on('error', (err) => {
			console.error(TAG, 'response error', err);
			reject({ error: 'Response error', exception: err });
		});

		request.end();
	});
};