exports.id = 'chess.start';

const Chess = apprequire('chess');

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