global.config = require('./config.json');
global.IO = require('./io/' + (process.argv[2] || config.io_driver));

[
[ 'warn',  '\x1b[35m' ],
[ 'error', '\x1b[31m' ],
[ 'info',   '\x1b[2m' ],
[ 'debug',   '\x1b[30m' ],
[ 'user',   '\x1b[35m' ],
[ 'ai',   '\x1b[35m' ],
].forEach(function(pair) {
	var method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
	console[method] = (console[method] || console.log).bind(console, color, '[' + method.toUpperCase() + ']', reset);
});

const { Wit, log, interactive } = require('node-wit');

const WitClient = new Wit({
	accessToken: config.WIT_AI_TOKEN,
	// logger: new log.Logger(log.DEBUG)
	actions: {

		send(request, response) {
			console.info('AI.send.request', JSON.stringify(request));
			console.info('AI.send.response', JSON.stringify(response));
			response.sessionId = request.sessionId;
			return IO.output(response);
		},

		sayHello: require('./ai/sayHello'),
		tellNameOf: require('./ai/tellNameOf'),
		setAlarm: require('./ai/setAlarm'),
		playSong: require('./ai/playSong'),
		pauseSong: require('./ai/pauseSong'),
		calculateMathExpr: require('./ai/calculateMathExpr'),

	},
});

let context = {};

IO.onInput(({ sessionId, text }) => {

	if (!text) {
		IO.startInput();
		return;
	}

	WitClient.runActions(sessionId, text, context)

	.catch((err) => {
		context = {};
		console.error('Resetting conversation');
		return IO.output(err);
	})

	// Finally
	.then(function() {
		IO.startInput();
	});

});

IO.startInput();
