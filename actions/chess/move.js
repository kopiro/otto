exports.id = 'chess.start';

const Chess = require(__basedir + '/actions_support/chess');

module.exports = function({ sessionId, result }, session_model) {
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
			game.userMove(user_move);

			// The AI could be very slow to detect the right move to do,
			// so resolve immediately and think about later
			resolve({
				speech: '',
				contextOut: [
				{ name: "chess_game", lifespan: 10 }
				],
			});

			setTimeout(() => { 
				game.aiMove(); 
			}, 0);
		})
		.catch(reject);

	});
};