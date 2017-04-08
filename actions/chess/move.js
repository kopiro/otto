exports.id = 'chess.start';

const Chess = require(__basedir + '/actions_support/chess');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const from = p.from.toLowerCase();
		const to = p.to.toLowerCase();

		const game = Chess.getGame(sessionId);

		const user_move = game.chess.moves({ verbose: true }).filter((m) => { 
			return m.color === 'w'; 
		}).find((m) => {
			return m.from === from && m.to === to;
		});

		if (user_move == null) {
			return resolve({
				speech: "Mi dispiace, ma questa mossa non sembra essere valida",
				contextOut: [
				{ name: "chess_game", lifespan: 1 }
				],
			});
		}

		game.chess.move(user_move);
		
		// Socket could be nil
		if (game.socket) {
			game.socket.emit('fen', game.chess.fen());
		}

		const ai_move = game.chess.moves({ verbose: true }).filter((m) => { 
			return m.color === 'b'; 
		}).getRandom()

		game.chess.move(ai_move);

		// Socket could be nil
		if (game.socket) {
			game.socket.emit('fen', game.chess.fen());
		}

		return resolve({
			speech: "Ok, io muovo " + ai_move.from + " in " + ai_move.to,
			contextOut: [
			{ name: "chess_game", lifespan: 1 }
			],
		});

	});
};