exports.id = 'chess.start';

const Chess = require(__basedir + '/actions_support/chess');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		// We are the white
		// Otto is black

		Chess.getGame(sessionId)
		.then((game) => {

			const from = p.from.toLowerCase();
			const to = (p.to || '').toLowerCase();

			const user_moves = game.getLogic().moves({ verbose: true })
			.filter((m) => { 
				return m.color === 'w'; 
			});

			console.debug(exports.id, 'user moves', user_moves);

			const user_move = user_moves
			.find((m) => {
				if (p.piece) return m.piece === p.piece && m.to === to;
				if (from) return m.from === from && m.to === to;
			});

			if (user_move == null) {
				return resolve({
					speech: "Mi dispiace, ma questa mossa non sembra essere valida",
					contextOut: [
					{ name: "chess_game", lifespan: 10 }
					],
				});
			}

			// Process my move
			game.move(user_move);

			// Think and move
			const ai_move = game.getAIMove();
			game.move(ai_move);

			return resolve({
				speech: "Ok, io muovo " + Chess.PIECES[ai_move.piece] + " in " + ai_move.to,
				contextOut: [
				{ name: "chess_game", lifespan: 10 }
				],
			});

		})
		.catch(reject);

	});
};