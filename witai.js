require('./boot');

const { Wit, log, interactive } = require('node-wit');
let AI = require('./ai');

AI.send = function send(request, response) {
	console.info('AI.send.request', JSON.stringify(request));
	console.info('AI.send.response', JSON.stringify(response));
	response.sessionId = response.sessionId || request.sessionId;
	return IO.output(response);
};

const WitClient = new Wit({
	accessToken: config.WIT_AI_TOKEN,
	// logger: new log.Logger(log.DEBUG)
	actions: AI
});

let context = {};

IO.onInput(({ sessionId, text }) => {

	if (!text) {
		IO.startInput();
		return;
	}

	WitClient.runActions(sessionId, text, context)

	.then((response) => {
		response.sessionId = sessionId;
		return IO.output(response);
	})

	.catch((err) => {
		context = {};
		console.error('Resetting conversation for errors', err);
		return IO.output(err);
	})

	// Finally
	.then(function() {
		IO.startInput();
	});

});

IO.startInput();
