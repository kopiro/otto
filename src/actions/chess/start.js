exports.id = 'chess.start';

const Chess = apprequire('chess');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Chess.createGame(sessionId)
		.then((game) => {

			resolve({
				contextOut: [
				{ name: "chess_game", lifespan: 10 }
				],
				data: {
					game: {
						id: 'chess',
						url: game.getUrl()
					}
				}
			});

		});

	});
};