/**
 * Server
 * Handle HTTP inbound connections, by providing routers where you can attach HTTP routes.
 */

const TAG = 'Server';

const _config = config.server;

const http = require('http');
const socketio = require('socket.io');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const server = http.createServer(app);
const io = socketio(server);

app.set('title', __package.name);

exports.getAbsoluteURIByRelativeURI = function (link) {
	return _config.domain + link;
};

// Routers

exports.routerIO = express.Router();
exports.routerApi = express.Router();
exports.routerActions = express.Router();
exports.routerListeners = express.Router();

// Configure routers

// API Router

exports.routerApi.use(bodyParser.json());
exports.routerApi.use(bodyParser.urlencoded({
	extended: true
}));

exports.routerApi.get('/', (req, res) => {
	res.json({
		name: __package.name,
		version: __package.version
	});
});

// Listeners

exports.routerListeners.use(bodyParser.json());
exports.routerListeners.use(bodyParser.urlencoded({
	extended: true
}));

// web-client public
app.use(express.static(__basedir + '/web-client/build'));

// public
app.use('/tmp', express.static(__tmpdir));

// Handle all routers
app.use('/io', exports.routerIO);
app.use('/api', exports.routerApi);
app.use('/actions', exports.routerActions);
app.use('/listeners', exports.routerListeners);

exports.io = io;
exports.app = app;

exports.start = function () {
	server.listen({
		port: _config.port,
		server: '0.0.0.0'
	}, () => {
		console.info(`HTTP Server has started: http://0.0.0.0:${_config.port}`);
	});
};