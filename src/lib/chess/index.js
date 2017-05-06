const TAG = 'Chess';

const Chess = require('chess.js').Chess;
const Server = apprequire('server');

const Sockets = {};

const DEPTH = 2;

const SPEECH_MOVING = [
"Sto muovendo {piece} in {to}",
"Sto sposando {piece} in {to}",
"Vediamo cosa fai, sposto {piece} in {to}",
"Provo a mettere {piece} in {to}",
"Uhm... forse spostando {piece} in {to}"
];

const evaluationBoard = { w: {

	p: [
	[0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
	[5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
	[1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
	[0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
	[0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
	[0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
	[0.5,  1.0, 1.0,  -2.0, -2.0,  1.0,  1.0,  0.5],
	[0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
	],

	b: [
	[ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
	[ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
	[ -1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
	[ -1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
	[ -1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
	[ -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
	[ -1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
	[ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
	],

	r: [
	[  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
	[  0.5,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  0.5],
	[ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
	[ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
	[ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
	[ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
	[ -0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
	[  0.0,   0.0, 0.0,  0.5,  0.5,  0.0,  0.0,  0.0]
	],

	k: [
	[ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
	[ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
	[ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
	[ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
	[ -2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
	[ -1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
	[  2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0 ],
	[  2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0 ]
	],

	n: [
	[-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
	[-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
	[-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
	[-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
	[-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
	[-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
	[-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
	[-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
	],

	q: [
	[ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
	[ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
	[ -1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
	[ -0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
	[  0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5],
	[ -1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0],
	[ -1.0,  0.0,  0.5,  0.0,  0.0,  0.0,  0.0, -1.0],
	[ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
	]

}};

evaluationBoard.b = {};
_.each(evaluationBoard.w, (value, key) => {
	evaluationBoard.b[ key ] = value.slice().reverse();
});

const scoreBoard = {
	p: 10,
	r: 50,
	n: 30,
	b: 30,
	q: 90,
	k: 900
};

function minimaxRoot(depth, game, turn) {
	let new_game_moves = game.moves({ verbose: true });
	let best_move = -9999;
	let best_move_found;

	for (let i = 0; i < new_game_moves.length; i++) {
		const new_game_move = new_game_moves[i];
		game.move(new_game_move);
		let value = minimax(depth - 1, game, -10000, 10000, !turn);
		game.undo();
		if (value >= best_move) {
			best_move = value;
			best_move_found = new_game_move;
		}
	}

	return best_move_found;
}

function minimax(depth, game, alpha, beta, turn) {
	if (depth === 0) return -evaluateBoard(game.board());

	let new_game_moves = game.moves({ verbose: true });
	let best_move = (turn ? -1 : 1) * 9999;
	
	for (let i = 0; i < new_game_moves.length; i++) {
		game.move(new_game_moves[i]);
		let best_move_opt = minimax(depth - 1, game, alpha, beta, !turn);
		best_move = Math[ turn ? 'max' : 'min' ](best_move, best_move_opt);
		game.undo();
		if (turn) alpha = Math.max(alpha, best_move);
		else beta = Math.min(beta, best_move);
		if (beta <= alpha) {
			return best_move;
		}
	}

	return best_move;
}

function evaluateBoard(board) {
	let totalEvaluation = 0;
	for (let i = 0; i < 8; i++) {
		for (let j = 0; j < 8; j++) {
			totalEvaluation += getPieceValue(board[i][j], i ,j);
		}
	}
	return totalEvaluation;
}

function getPieceValue(piece, x, y) {
	if (piece === null) return 0;
	const sign = (piece.color === 'w' ? 1 : -1);
	return sign * (scoreBoard[piece.type] + evaluationBoard[piece.color][piece.type][y][x]);
}

const GameSchema = new mongoose.Schema({
	session: { type: String, ref: 'sessions' },
	fen: String
});

_.extend(GameSchema.methods, {
	recover: function() {
		const logic = this.getLogic();
		if (logic.game_over()) {
			console.debug(TAG, 'recovering game, reset');
			logic.reset();
			this.fen = logic.fen();
			this.save();
		} else if (logic.turn() === 'b') {
			console.debug(TAG, 'recovering game, AI move');
			this.aiMove();
		}
	},
	getLogic: function() {
		if (this.logic == null) this.logic = new Chess( this.fen || void(0) );
		return this.logic;
	},
	getSocket: function() {
		return Sockets[ this._id ];
	},
	setSocket: function(socket) {
		Sockets[ this._id ] = socket;
	},
	getUrl: function() {
		return `${config.server.domainWithPort}/actions/chess/` + this._id;
	},
	move: function(move, source) {
		const logic = this.getLogic();

		logic.move(move);
		this.set('fen', logic.fen());
		this.save();

		this.sendFENToSocket();

		if (logic.game_over()) {
			if (source === 'user') {
				IOManager.output({
					speech: "Uffa, come fai ad essere così forte!"
				}, this.session);
			} else if (source === 'ai') {
				IOManager.output({
					speech: "Ops, forse ho vinto!"
				}, this.session);
			}
		} else {
			// Check if we can speech over game. Otherwise just ignore this phase
			if (IOManager.driversCapabilities[ this.session.io_id ].speechOverGame) {
				if (source === 'ai') {
					IOManager.output({
						speech: SPEECH_MOVING.getRandom().replace('{piece}', exports.PIECES[move.piece]).replace('{to}', move.to)
					}, this.session);
				}
			}
		}
	},
	sendFENToSocket: function() {
		if (this.getSocket() == null) return;
		this.getSocket().emit('fen', this.fen);
	},
	userMove: function(move) {
		const logic = this.getLogic();
		if (logic.game_over()) return this.sendFENToSocket();
		if (logic.turn() === 'b') return this.sendFENToSocket();

		this.move(move, 'user');
	},
	aiMove: function() {
		const logic = this.getLogic();
		if (logic.game_over()) return this.sendFENToSocket();
		if (logic.turn() === 'w') return this.sendFENToSocket();

		const ai_move = minimaxRoot(DEPTH, logic, true);
		this.move(ai_move, 'ai');
	}
});

const Game = mongoose.model('chess_games', GameSchema);

exports.PIECES = {
	k: "il re",
	q: "la regina",
	p: "una pedina", 
	b: "l'alfiere",
	n: "il cavallo",
	r: "la torre",
};

Server.routerActions.use('/chess/public', require('express').static(__dirname + '/public'));

Server.routerActions.get('/chess/:id', (req, res) => {
	res.render(__dirname.replace(__basedir, '../..') + '/web/views/main', {
		layout: false,
		id: req.params.id
	});
});

// Instantiatate socket.io connection
Server.io.on('connection', (socket) => {

	socket.on('start', (data) => {
		console.log(`Client ${data.id} opened UI`);

		Game
		.findOne({ _id: data.id })
		.populate('session')
		.then((game) => {
			game.setSocket(socket);
			socket.emit('fen', game.getLogic().fen());
		});
	});

	socket.on('move', (data) => {
		console.log(`Client ${data.id} move`);

		Game
		.findOne({ _id: data.id })
		.populate('session')
		.then((game) => {
			game.userMove({
				from: data.from,
				to: data.to
			});
			game.aiMove();
		});
	});

});

exports.createGame = function(sessionId) {
	return new Promise((resolve, reject) => {
		exports.getGame(sessionId)
		.then(resolve)
		.catch((err) => {
			new Game({ session: sessionId })
			.save()
			.then(resolve)
			.catch(reject);
		});
	});
};

exports.destroyGame = function(sessionId) {
	Game
	.findOne({ session: sessionId })
	.remove()
	.exec();
};

exports.getGame = function(sessionId) {
	return new Promise((resolve, reject) => {
		Game
		.findOne({ session: sessionId })
		.populate('session')
		.then((game) => {
			game.recover();
			resolve(game);
		})
		.catch(reject);

	});
};
