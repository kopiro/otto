const TAG = 'Chess';

const Chess = require('chess.js').Chess;
const Server = apprequire('server');
const Sockets = {};

const Game = Memory.__bookshelf.Model.extend({
	tableName: 'chess_games',
	getLogic: function() {
		return new Chess( this.get('fen') || void(0) );
	},
	getSocket: function() {
		return Sockets[ this.get('session_id') ];
	},
	getUrl: function() {
		const sessionId = encodeURIComponent( this.get('session_id') );
		return `${config.server.domainWithPort}/actions/chess#${sessionId}`;
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
