const TAG = 'API.AI';

let apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: 'it'
});

let ai_actions = require(__basedir + '/aiactions');
console.debug(TAG, _.keys(ai_actions));

exports.textRequest = function(data, sessionId, text) {
	return new Promise((resolve, reject) => {
		text = text.replace(AI_NAME_REGEX, '');

		let request = apiaiClient.textRequest(text, {
			sessionId: sessionId || Date.now()
		});

		request.on('response', function(response) {
			let {result} = response;
			console.debug(TAG, 'response', result);

			if (_.isFunction(ai_actions[result.action])) {
				console.info(TAG, `calling ${result.action}()`);

				ai_actions[result.action](result)
				.then(function(out) {
					console.info(TAG, `result of ${result.action}()`, out);
					if (_.isString(out)) out = { text: out };

					out.data = data;
					IO.output(out).then(IO.startInput);
				})
				.catch(function(err) {
					console.error(TAG, `error in of ${result.action}()`, err);
					if (_.isString(err)) err = { text: err };
		
					err.data = data;
					IO.output(err).then(IO.startInput);
				});

			} else if (result.fulfillment.speech) {
				console.info(TAG, `direct response = ${result.fulfillment.speech}`);

				let out = { text: result.fulfillment.speech };
				out.data = data;
				IO.output(out).then(IO.startInput);

			} else {
				console.error(TAG, `No strategy found`);
				IO.startInput();
			}

		});

		request.on('error', (err) => {
			console.error(TAG, err);
			IO.startInput();
		});

		request.end();
	});
};