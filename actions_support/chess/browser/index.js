window.$ = require('jquery');

const Chessboard = require('./chessboard.js');
const Chess = require('chess.js').Chess;

const game = new Chess();

const config = { 
	sessionId: decodeURIComponent(window.location.hash.replace('#', '')) 
};

////////////
// Socket //
////////////

const socket = io();

socket.emit('start', config);

socket.on('fen', (fen) => {
	game.load(fen);
	board.position(fen);
});

////////////
// Events //
////////////

function onDragStart(source, piece, position, orientation) {
	if (game.game_over() === true || (game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
		return false;
	}
}

function onDrop(source, target) {
	let move = game.move({
		from: source,
		to: target,
		promotion: 'q'
	});
	if (move === null) return 'snapback';
	updateStatus();
}

function onSnapEnd() {
	board.position(game.fen());
}

const board = ChessBoard('board1', {
	draggable: true,
	position: 'start',
	onDragStart: onDragStart,
	onDrop: onDrop,
	onSnapEnd: onSnapEnd
});
