require('./boot');

let AI = require('./ai');
var app = require('apiai')(config.APIAI_TOKEN, {
	language: 'it'
});

let context = {};

IO.onInput(({ sessionId, text }) => {

	if (text == null) {
		IO.startInput();
		return;
	}

	text = text.replace(AI_NAME_REGEX, '');

	let request = app.textRequest(text, {
		sessionId: sessionId
	});

	request.on('response', function(response) {
		let {result} = response;
		console.debug(JSON.stringify(result, null, 2));

		if (_.isFunction(AI[result.action])) {
			console.info(`Calling AI.${result.action}()`);

			AI[result.action](result)
			.then(function(out) {
				console.info(`Result of AI.${result.action}()`, JSON.stringify(out, null, 2));
				
				out.sessionId = sessionId;
				IO.output(out).then(IO.startInput);
			})
			.catch(function(err) {
				console.error(`Error in of AI.${result.action}()`, JSON.stringify(err, null, 2));

				err.sessionId = sessionId;
				IO.output(err).then(IO.startInput);
			});

		} else if (result.fulfillment.speech) {
			console.info(`Direct response = ${result.fulfillment.speech}`);

			let out = {
				text: result.fulfillment.speech
			};
			out.sessionId = sessionId;
			IO.output(out).then(IO.startInput);

		} else {
			console.error(`No strategy found`);

			let out = {
				text: "Non ti capisco, scusami"
			};
			out.sessionId = sessionId;
			IO.output(out).then(IO.startInput);
		}
		
	});

	request.on('error', function(err) {
		context = {};
		console.error(err);
		IO.output(err).then(IO.startInput);
	});

	request.end();
});

IO.startInput();
