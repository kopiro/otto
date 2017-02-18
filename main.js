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
		console.debug(JSON.stringify(response, null, 2));
		let {result} = response;

		if (result.action) {
			AI[result.action](result)
			.then(function(out) {
				out.sessionId = sessionId;
				IO.output(out).then(IO.startInput);
			})
			.catch(function(err) {
				err.sessionId = sessionId;
				IO.output(out).then(IO.startInput);
			});
		} else if (result.fulfillment.speech) {
			let out = {
				text: result.fulfillment.speech
			};
			out.sessionId = sessionId;
			IO.output(out).then(IO.startInput);
		}
		
	});

	request.on('error', function(err) {
		context = {};
		console.error(err);
		IO.output(err);
	});

	request.end();
});

IO.startInput();
