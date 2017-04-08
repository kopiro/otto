const TAG = 'Chess';

const Chess = require('chess.js').Chess;
const Server = apprequire('server');

let MEM = {};

Server.routerActions.use('/chess', require('express').static(__dirname + '/html'));

// Build index.js
var b = require('browserify')();
b.add(__dirname + '/browser/index.js');
b.bundle().pipe(fs.createWriteStream(__dirname + '/html/index.js'));

Server.io.on('connection', (socket) => {
	socket.on('start', (data) => {
		console.log(`Client ${data.sessionId} opened UI`);
		exports.assignSocket(data.sessionId, socket); 
	});
});

exports.createGame = function(sessionId) {
	const sessionIdUrl = encodeURIComponent(sessionId);
	const url = `${config.server.domainWithPort}/actions/chess#${sessionIdUrl}`;

	MEM[ sessionId ] = {
		chess: new Chess(),
		url: url,
		ai_turn: true,
		socket: null
	};

	return MEM[ sessionId ];
};

exports.destroyGame = function(sessionId) {
	delete MEM[ sessionId ];
};

exports.assignSocket = function(sessionId, socket) {
	if (MEM[ sessionId ] == null) {
		console.error(TAG, `No game with ${sessionId}`);
		return;
	}
	MEM[ sessionId ].socket = socket;
};

exports.getGame = function(sessionId) {
	return MEM[ sessionId ];
};
