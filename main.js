require('./boot');

if (false == config.disableCron) {
	require('./cron');
}

let AI = require('./ai');

var app = require('apiai')(config.APIAI_TOKEN, {
	language: 'it'
});

let context = {};

IO.onInput(({ sessionId, data, text }) => {

	if (text == null) {
		IO.startInput();
		return;
	}

	text = text.replace(AI_NAME_REGEX, '');

	let request = app.textRequest(text, {
		sessionId: sessionId || Date.now()
	});

	request.on('response', function(response) {
		let {result} = response;
		console.debug('API.AI response', JSON.stringify(result, null, 2));

		if (_.isFunction(AI[result.action])) {
			console.info(`Calling AI.${result.action}()`);

			AI[result.action](result)
			.then(function(out) {
				console.info(`Result of AI.${result.action}()`, JSON.stringify(out, null, 2));
				
				out.data = data;
				IO.output(out).then(IO.startInput);
			})
			.catch(function(err) {
				console.error(`Error in of AI.${result.action}()`, JSON.stringify(err, null, 2));

				err.data = data;
				IO.output(err).then(IO.startInput);
			});

		} else if (result.fulfillment.speech) {
			console.info(`API.AI Direct response = ${result.fulfillment.speech}`);

			let out = {
				text: result.fulfillment.speech
			};
			out.data = data;
			IO.output(out).then(IO.startInput);

		} else {
			console.error(`No strategy found`);
			IO.startInput();
		}
		
	});

	request.on('error', (err) => {
		context = {};
		console.error('API.AI error', err);
		IO.output(err).then(IO.startInput);
	});

	request.end();
});

IO.startInput();
