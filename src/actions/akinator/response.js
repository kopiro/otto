exports.id = 'akinator.response';

const _ = require('underscore');

const Akinator = apprequire('akinator');

const AKINATOR_ANS_MAP = {
	'y': '0',
	'n': '1',
	'maybe': '2',
	'probably': '3',
	'probablynot': '4'
};

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		const aki_client = Akinator.data[sessionId];
		if (aki_client == null) {
			console.error(exports.id, 'Unable to find a client with this SID', sessionId);
			return reject('Unable to find a client with this SID');
		}

		const context_response = _.findWhere(result.contexts, {
			name: "akinator_response"
		});

		if (context_response == null) {
			return resolve({
				speech: 'Scusa, ma non capisco la tua risposta. Ripeto:\n' + aki_client.speech,
				contextOut: [
				{ name: "akinator_response", lifespan: 1 }
				],
				data: {
					forceText: true,
					replies: aki_client.replies
				}
			});
		}

		// Set the new resolver
		aki_client.resolver = resolve;

		// Send the answer
		aki_client.client.sendAnswer(AKINATOR_ANS_MAP[context_response.parameters.q]);
	});
};