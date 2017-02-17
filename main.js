require('./boot');

const { Wit, log, interactive } = require('node-wit');

const WitClient = new Wit({
	accessToken: config.WIT_AI_TOKEN,
	// logger: new log.Logger(log.DEBUG)
	actions: {

		send(request, response) {
			console.info('AI.send.request', JSON.stringify(request));
			console.info('AI.send.response', JSON.stringify(response));
			response.sessionId = response.sessionId || request.sessionId;
			return IO.output(response);
		},

		sayHello: require('./ai/sayHello'),
		tellNameOf: require('./ai/tellNameOf'),
		setAlarm: require('./ai/setAlarm'),
		playSong: require('./ai/playSong'),
		pauseSong: require('./ai/pauseSong'),
		calculateMathExpr: require('./ai/calculateMathExpr'),
		getPhoto: require('./ai/getPhoto')

	},
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
