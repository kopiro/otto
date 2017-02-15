var IO = require('./io');

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

const config = require('./config.json');
const {Wit, log, interactive} = require('node-wit');

const WitClient = new Wit({
	accessToken: config.WIT_AI_TOKEN,
	actions: {

		send(request, response) {
			console.info('AI.send', request, response);
			return IO.output(response.text);
		},

		sayHello(request) {
			console.info('AI.sayHello', request);
			return new Promise(function(resolve, reject) {
				resolve({
					user: request.entities.contact[0].value
				});
			});
		},

		tellNameOf(request) {
			console.info('AI.tellNameOf', request);
			return new Promise(function(resolve, reject) {
				var who = request.entities.contact[0].value.toLowerCase();
				switch (who) {
					case 'mamma':
					resolve({ phrase: 'La mia mamma è Valentina' });
					break;
					case 'papà':
					resolve({ phrase: 'Il mio papà è Flavio!' });
					break;
					default:
					reject({ 
						text: 'Non so chi sia ' + who
					});
					break;					
				}
			});
		},

		setAlarm(request) {
			console.info('AI.setAlarm', JSON.stringify(request));
			return new Promise(function(resolve, reject) {
				var moment = require('moment');
				moment.locale('it');

				var when = moment(request.entities.datetime[0].value);
				if (when.diff(moment()) < 0) {
					reject({
						text: "Non posso ancora andare indietro nel tempo"
					});
					return;
				}

				var when_human = when.calendar();

				resolve({
					alarmTime: when_human
				});
			});
		}

	},
	// logger: new log.Logger(log.DEBUG)
});

let sessionId = Date.now();
let context = {};

function converse() {
	console.info('Starting conversation');

	IO.input()

	.then(function(data) {
		return WitClient.runActions(sessionId, data.text, context);
	})

	.catch(function(err) {
		context = {};
		sessionId = Date.now();
		console.error('Resetting conversation');

		if (err.text) {
			return IO.output(err.text);
		}
	})

	// Finally
	.then(converse);
}

converse();
// interactive(WitClient);
