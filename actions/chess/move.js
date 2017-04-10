exports.id = 'chess.start';

const Chess = require(__basedir + '/actions_support/chess');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Chess.getGame(sessionId)
		.then((game) => {

			const from = p.from.toLowerCase();
			const to = (p.to || '').toLowerCase();

			const logic = game.getLogic();
			const socket = game.getSocket();

			const user_move = logic.moves({ verbose: true })
			.filter((m) => { 
				return m.color === 'w'; 
			})
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

			logic.move(user_move);
			if (socket) socket.emit('fen', logic.fen());

			const ai_move = logic.moves({ verbose: true }).filter((m) => { 
				return m.color === 'b'; 
			}).getRandom();

			logic.move(ai_move);
			if (socket) socket.emit('fen', logic.fen());

			game.set('fen', logic.fen());
			game.save();

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