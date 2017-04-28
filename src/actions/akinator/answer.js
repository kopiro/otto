exports.id = 'akinator.answer';
const Akinator = apprequire('akinator');

function cleanText(t) {
	const diacriticsRemove = require('diacritics').remove;
	return diacriticsRemove(t).toLowerCase();
}

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const akiClient = Akinator.data[sessionId];
		if (akiClient == null) {
			console.error(exports.id, 'Unable to find a client with this SID', sessionId);
			return reject();
		}

		if (result.resolvedQuery === 'Stop') {
			delete Akinator.data[sessionId];
		} else {

			const answer = _.find(akiClient.replies, (ans) => {
				return cleanText(ans.text) == cleanText(result.resolvedQuery);
			});

			console.debug(exports.id, 'sending', answer);

			if (answer == null) {
				return resolve({
					speech: 'Scusa, ma non capisco la tua risposta. Ripeto:\n' + akiClient.speech,
					contextOut: [
					{ name: "akinator_answer" }
					],
					data: {
						forceText: true,
						replies: akiClient.replies
					}
				});
			}

			akiClient.resolver = resolve;
			akiClient.client.sendAnswer(answer.id);
		}
	});
};