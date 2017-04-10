exports.id = 'akinator.start';
const akinator = require(__basedir + '/support/akinator');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		const akiClient = akinator.data[sessionId] = {
			client: akinator.create('it'),
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
				contextOut: [
				{ name: "akinator_answer", lifespan: 10 }
				],
				data: {
					forceText: true,
					replies: akiClient.replies
				}
			});
		},

		// on finish
		(characters) => {
			delete akinator.data[sessionId];
			const char = _.first(characters);
			return akiClient.resolver({
				speech: `Stiamo parlando di ${char.name} - ${char.description}`,
				data: {
					url: char.absolute_picture_path
				},
				contextOut: [
					{ name: "akinator_answer", lifespan: 0 } // Reset
				],

			});
		});
	});
};