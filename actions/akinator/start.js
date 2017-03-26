const Akinator = require(__basedir + '/support/akinator');
let akinatorClients = {};

exports.id = 'akinator.start';

module.exports = function(e, { data, io }) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);

		if (e.pending) {

			let { question, answers, replies } = akinatorClients[data.sessionId];

			if (e.params.text !== 'Stop') {
				
				const answer = _.find(answers, (ans) => {
					return ans.text == e.params.text;
				});

				console.debug(exports.id, 'sending', answer);

				if (answer == null) {
					resolve({
						text: 'Scusami, ma non capisco la tua risposta. Ripeto:\n' + question.text,
						forceText: true,
						replies: replies
					});
				} else {
					akinatorClients[data.sessionId].promiseResolver = resolve;
					akinatorClients[data.sessionId].client.sendAnswer(answer.id);
				}

			} else {
				delete io.pendingActions[data.sessionId];
				delete akinatorClients[data.sessionId];
			}

		} else {

			const akiClient = akinatorClients[data.sessionId] = {
				client: new Akinator('it'),
				question: null,
				answers: null,
				promiseResolver: resolve
			};

			akiClient.client.hello(data.title, (question, answers) => {

				console.debug(exports.id, 'hello', question, answers);

				io.pendingActions[data.sessionId] = exports.id;
				akiClient.question = question;
				akiClient.answers = answers;
				akiClient.replies = _.compact(answers.map((ans) => {
					if (ans.text == null) return;
					return {
						id: ans.id,
						text: ans.text
					};
				})).concat({
					id: -1,
					text: 'Stop'
				});

				akiClient.promiseResolver({
					text: question.text,
					forceText: true,
					replies: akiClient.replies
				});

			}, (characters) => {
				const char = _.first(characters);

				akiClient.promiseResolver({
					text: `Stiamo parlando di ${char.name} - ${char.description}\n${char.absolute_picture_path}`
				});

				delete io.pendingActions[data.sessionId];
				delete akinatorClients[data.sessionId];
			});

		}		
	});
};