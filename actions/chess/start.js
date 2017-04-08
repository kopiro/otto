exports.id = 'chess.start';

const Chess = require(__basedir + '/actions_support/chess');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const game = Chess.createGame(sessionId);

		resolve({
			speech: 'Perfetto, giochiamo!',
			contextOut: [
			{ name: "chess_game", lifespan: 1 }
			],
			data: {
				url: game.url
			}
		});

	});
};