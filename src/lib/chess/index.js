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

const Game = ORM.__bookshelf.Model.extend({
	tableName: 'chess_games',
	session: function() {
		return this.belongsTo(ORM.Session, 'session_id');
	},
	recover: function() {
		const logic = this.getLogic();
		if (logic.game_over()) {
			console.debug(TAG, 'recovering game, reset');
			logic.reset();
			this.set('fen', logic.fen());
			this.save();
		} else if (logic.turn() === 'b') {
			console.debug(TAG, 'recovering game, AI move');
			this.aiMove();
		}
	},
	getLogic: function() {
		if (this.logic == null) this.logic = new Chess( this.get('fen') || void(0) );
		return this.logic;
	},
	getSocket: function() {
		return Sockets[ this.get('session_id') ];
	},
	getUrl: function() {
		const sessionId = encodeURIComponent( this.get('session_id') );
		return `${config.server.domainWithPort}/actions/chess/#${sessionId}`;
	},
	move: function(move, source) {
		const logic = this.getLogic();

		logic.move(move);
		this.set('fen', logic.fen());
		this.save();

		if (this.getSocket() != null) {
			this.getSocket().emit('fen', this.get('fen'));
		}

		if (logic.game_over()) {
			if (source === 'user') {
				IOManager.output({
					speech: "Uffa, come fai ad essere così forte!"
				}, this.related('session'));
			} else if (source === 'ai') {
				IOManager.output({
					speech: "Ops, forse ho vinto!"
				}, this.related('session'));
			}
		} else {
			if (source === 'ai') {
				IOManager.output({
					speech: 
					SPEECH_MOVING.getRandom()
					.replace('{piece}', exports.PIECES[move.piece])
					.replace('{to}', move.to)
				}, this.related('session'));
			}
		}
	},
	userMove: function(move) {
		const logic = this.getLogic();
		if (logic.game_over()) return;
		if (logic.turn() === 'b') return;

		this.move(move, 'user');
	},
	aiMove: function() {
		const logic = this.getLogic();
		if (logic.game_over()) return;
		if (logic.turn() === 'w') return;

		console.debug(TAG, 'thinking...');

		const ai_move = minimaxRoot(DEPTH, logic, true);
		this.move(ai_move, 'ai');
	}
});

exports.PIECES = {
	k: "il re",
	q: "la regina",
	p: "una pedina", 
	b: "l'alfiere",
	n: "il cavallo",
	r: "la torre",
};

Server.routerActions.use('/chess', require('express').static(__dirname + '/public'));

// Instantiatate socket.io connection
Server.io.on('connection', (socket) => {

	socket.on('start', (data) => {
		console.log(`Client ${data.sessionId} opened UI`);

		exports.getGame(data.sessionId)
		.then((game) => {
			exports.assignSocket(data.sessionId, socket);
			socket.emit('fen', game.getLogic().fen());
		});
	});

	socket.on('move', (data) => {
		exports.getGame(data.sessionId)
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
			new Game({ session_id: sessionId })
			.save()
			.then(resolve)
			.catch(reject);
		});
	});
};

exports.destroyGame = function(sessionId) {
	
};

exports.assignSocket = function(sessionId, socket) {
	Sockets[ sessionId ] = socket;
};

exports.getGame = function(sessionId) {
	return new Promise((resolve, reject) => {
		new Game()
		.where('session_id', sessionId)
		.fetch({ 
			require: true,
			withRelated: ['session']
		})
		.then((game) => {
			game.recover();
			resolve(game);
		})
		.catch(reject);

	});
};
