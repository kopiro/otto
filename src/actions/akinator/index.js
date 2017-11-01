exports.id = 'akinator';
const Akinator = apprequire('akinator');

function cleanText(t) {
	const diacriticsRemove = require('diacritics').remove;
	return diacriticsRemove(t).toLowerCase();
}

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		if (result.isAnswer) {
			const akiClient = Akinator.data[sessionId];
			if (akiClient == null) {
				console.error(exports.id, 'Unable to find a client with this SID', sessionId);
				return reject('Unable to find a client with this SID');
			}

			const answer = _.find(akiClient.replies, (ans) => {
				return cleanText(ans.text) == cleanText(result.resolvedQuery);
			});

			if (answer == null) {
				return resolve({
					speech: 'Scusa, ma non capisco la tua risposta. Ripeto:\n' + akiClient.speech,
					data: {
						forceText: true,
						replies: akiClient.replies,
						pending: {
							action: exports.id,
							data: _.extend(result, { isAnswer: true })
						}
					}
				});
			}

			akiClient.resolver = resolve;
			akiClient.client.sendAnswer(answer.id);

			return;
		}
		
		const akiClient = Akinator.data[sessionId] = {
			client: Akinator.create('it'),
			speech: null, 
			replies: null,
			resolver: resolve
		};

		akiClient.client.hello(null, 

		// on start
		(question, answers) => {
			console.debug(exports.id, 'hello', question, answers);

			akiClient.speech = question.text;
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

			return akiClient.resolver({
				speech: akiClient.speech,
				data: {
					forceText: true,
					replies: akiClient.replies,
					pending: {
						action: exports.id,
						data: _.extend(result, { isAnswer: true })
					}
				}
			});
		},

		// on finish
		(characters) => {
			delete Akinator.data[sessionId];
			const char = _.first(characters);
			return akiClient.resolver({
				speech: `Stiamo parlando di ${char.name} - ${char.description}`,
				data: {
					url: char.absolute_picture_path
				}
			});
		});
	});
};