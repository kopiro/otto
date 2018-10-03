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

// Configure view engine
app.set('views', __basedir + '/server/web/views');
app.engine('hbs', require('express-handlebars')({ 
	defaultLayout: 'main',
	extname: '.hbs',
	layoutsDir: __basedir + '/server/web/views/layouts',
	partialsDir: __basedir + '/server/web/views/partials'
}));
app.set('view engine', 'hbs');

// Routers

exports.routerIO = express.Router();
exports.routerApi = express.Router();
exports.routerAdmin = express.Router();
exports.routerActions = express.Router();
exports.routerListeners = express.Router();

// Configure routers

// API Router

exports.routerApi.use(bodyParser.json());
exports.routerApi.use(bodyParser.urlencoded({ extended: true }));

exports.routerApi.get('/', (req, res) => {
	res.json({
		name: __package.name,
		version: __package.version
	});
});

// Listeners

exports.routerListeners.use(bodyParser.json());
exports.routerListeners.use(bodyParser.urlencoded({ extended: true }));

// public
app.use(express.static(__basedir + '/server/public'));

// Serve tmp directory - be careful here to do not put sensitive data
app.use('/tmp', express.static(__basedir + '/tmp'));

// Handle all routers
app.use('/io', exports.routerIO);
app.use('/api', exports.routerApi);
app.use('/admin', exports.routerAdmin);
app.use('/actions', exports.routerActions);
app.use('/listeners', exports.routerListeners);

exports.io = io;
exports.app = app;

exports.start = function() {
	server.listen({ port: _config.port, server: '0.0.0.0' }, () => {
		console.info(`HTTP Server has started on port ${_config.port}`);
	});
};