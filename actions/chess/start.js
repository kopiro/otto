exports.id = 'chess.start';

const Chess = require(__basedir + '/actions_support/chess');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Chess.createGame(sessionId)
		.then((game) => {

			resolve({
				speech: 'Perfetto, giochiamo!',
				contextOut: [
				{ name: "chess_game", lifespan: 10 }
				],
				data: {
					url: game.getUrl()
				}
			});

		});

	});
};