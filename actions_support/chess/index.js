const TAG = 'Chess';

const Chess = require('chess.js').Chess;
const Server = apprequire('server');
const Sockets = {};

const DEPTH = 3;

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

function minimaxRoot(depth, game, isMaximisingPlayer) {
	let newGameMoves = game.moves({ verbose: true });
	let best_move = -9999;
	let best_move_found;

	for (let i = 0; i < newGameMoves.length; i++) {
		const newGameMove = newGameMoves[i];
		game.move(newGameMove);
		let value = minimax(depth - 1, game, -10000, 10000, !isMaximisingPlayer);
		game.undo();
		if (value >= best_move) {
			best_move = value;
			best_move_found = newGameMove;
		}
	}

	return best_move_found;
}

function minimax(depth, game, alpha, beta, isMaximisingPlayer) {
	if (depth === 0) return -evaluateBoard(game.board());

	let newGameMoves = game.moves({ verbose: true });
	let best_move = (isMaximisingPlayer ? -1 : 1) * 9999;
	
	for (let i = 0; i < newGameMoves.length; i++) {
		game.move(newGameMoves[i]);
		best_move = Math.max(best_move, minimax(depth - 1, game, alpha, beta, !isMaximisingPlayer));
		game.undo();
		alpha = Math[ isMaximisingPlayer ? 'max' : 'min' ](alpha, best_move);
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

const Game = Memory.__bookshelf.Model.extend({
	tableName: 'chess_games',
	getLogic: function() {
		if (this.logic == null) this.logic = new Chess( this.get('fen') || void(0) );
		return this.logic;
	},
	getSocket: function() {
		return Sockets[ this.get('session_id') ];
	},
	getUrl: function() {
		const sessionId = encodeURIComponent( this.get('session_id') );
		return `${config.server.domainWithPort}/actions/chess#${sessionId}`;
	},
	getAIMove: function() {
		return minimaxRoot(DEPTH, this.getLogic(), true);
	},
	move: function(move) {
		const logic = this.getLogic();
		logic.move(move);
		this.set('fen', logic.fen());
		this.save();

		if (this.getSocket() != null) {
			this.getSocket().emit('fen', this.get('fen'));
		}
	}
});

exports.PIECES = {
	k: 'il re',
	q: 'la regina',
	p: 'una pedina', 
	b: 'l\'alfiere',
	n: 'il cavallo',
	r: 'la torre',
};

Server.routerActions.use('/chess', require('express').static(__dirname + '/html'));

// Build index.js
require('browserify')()
.add(__dirname + '/browser/index.js')
.bundle()
.pipe(fs.createWriteStream(__dirname + '/html/index.js'));

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

});

exports.createGame = function(sessionId) {
	return new Promise((resolve, reject) => {
		exports.getGame(sessionId)
		.then(resolve)
		.catch(() => {
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
	return new Game()
	.where('session_id', sessionId)
	.fetch({ require: true });
};
