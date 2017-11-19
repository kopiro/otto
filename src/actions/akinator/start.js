exports.id = 'akinator.start';

const _ = require('underscore');

const Akinator = apprequire('akinator');

const AKINATOR_ANS_MAP = {
	'y': 'Si',
	'n': 'No',
	'maybe': 'Forse',
	'probably': 'Probabilmente',
	'probablynot': 'Probabilmente no'
};

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		let aki_client = Akinator.data[sessionId];

		if (aki_client != null) {
			const context_yn_response = _.findWhere(result.contexts, {
				name: "akinator_restart"
			});
			if (context_yn_response == null || context_yn_response.parameters.q == null) {
				return resolve({
					speech: 'Stavi già giocando a questo gioco, vuoi ricominciare da dove avevi lasciato?',
					contextOut: [
					{ name: "akinator_restart", lifespan: 1 }
					]
				});
			}

			if (context_yn_response.parameters.q === 'n') {
				aki_client = null;
			} 
		}

		if (aki_client != null) {
			return resolve({
				speech: 'Ripeto:\n' + aki_client.speech,
				contextOut: [
				{ name: "akinator_response", lifespan: 1 }
				],
				data: {
					forceText: true,
					replies: aki_client.replies
				}
			});
		}


		aki_client = Akinator.data[sessionId] = {
			client: Akinator.create('it'),
			speech: null, 
			replies: null,
			resolver: resolve
		};

		aki_client.client.hello(null, 

		// on start
		(question, answers) => {
			console.debug(exports.id, 'hello', question, answers);

			aki_client.speech = question.text;
			aki_client.replies = _.values(AKINATOR_ANS_MAP);

			return aki_client.resolver({
				speech: aki_client.speech,
				contextOut: [
				{ name: "akinator_response", lifespan: 1 }
				],
				data: {
					forceText: true,
					replies: aki_client.replies
				}
			});
		},
			
		// on finish
		(characters) => {

			delete Akinator.data[sessionId];
			const char = _.first(characters);

			return aki_client.resolver({
				speech: `Stiamo parlando di ${char.name} - ${char.description}`,
				contextOut: [
				{ name: "akinator_response", lifespan: 0 }
				],
				data: {
					url: char.absolute_picture_path
				}
			});
		});
	});
};