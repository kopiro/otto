const TAG = 'Server';

const _config = config.server;

const http = require('http');
const socketio = require('socket.io');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const server = http.createServer(app);
const io = socketio(server);

const exphbs  = require('express-handlebars');
app.set('title', require(__basedir + '/package.json').name);
app.set('views', __basedir + '/server/web/views');
app.engine('hbs', exphbs({ 
	defaultLayout: 'main',
	extname: '.hbs',
	layoutsDir: __basedir + '/server/web/views/layouts',
	partialsDir: __basedir + '/server/web/views/partials'
}));
app.set('view engine', 'hbs');

app.get('/', (req, res) => {
	const p = require(__basedir + '/package.json');
	res.send('<h1>' + p.name + ' web server</h1>');
});

// Routers

const router_io = express.Router();
const router_api = express.Router();
const router_admin = express.Router();
const router_actions = express.Router();
const router_listeners = express.Router();

// Configure routers

router_api.use(bodyParser.json());
router_api.use(bodyParser.urlencoded({ extended: true }));

router_api.get('/', (req, res) => {
	const p = require(__basedir + '/package.json');
	res.json({
		name: p.name,
		version: p.version
	});
});

router_api.get('/fulfillment', (req, res) => {
	res.json({ error: { message: 'You should call in POST' } });
});
 
router_api.post('/fulfillment', async(req, res) => {
	if (req.body == null) {
		console.error(TAG, 'empty body');
		return res.json({ data: { error: 'Empty body' } });
	}

	console.info(TAG, 'request');
	console.dir(req.body, { depth: 10 });

	const body = req.body;
	const sessionId = body.sessionId;

	// From AWH can came any session ID, so ensure it exists on our DB
	let session = await IOManager.getSession(sessionId);
	if (session == null) {
		console.error(TAG, `creating a missing session ID with ${sessionId}`);
		session = new Data.Session({ _id: sessionId });
		session.save();
	}

	try {
		
		let fulfillment = await AI.apiaiResultParser(body, session);
		fulfillment.data.remoteTransform = true;
		
		console.info(TAG, 'output fulfillment');
		console.dir(fulfillment, { depth: 10 });

		res.json(fulfillment);
	
	} catch (ex) {
		console.info(TAG, 'error', ex);
		res.json({ data: { error: ex } });
	}
});

router_listeners.use(bodyParser.json());
router_listeners.use(bodyParser.urlencoded({ extended: true }));

// public
app.use(express.static(__basedir + '/server/public'));

// tmp
app.use('/tmp', express.static(__basedir + '/tmp'));

// dynamics
app.use('/io', router_io);
app.use('/api', router_api);
app.use('/admin', router_admin);
app.use('/actions', router_actions);
app.use('/listeners', router_listeners);

function start() {
	server.listen({ port: _config.port, server: '0.0.0.0' }, () => {
		console.info(`HTTP Server has started on port ${_config.port}`);
	});
}

module.exports = {
	start: start,
	app: app,
	io: io,
	routerActions: router_actions,
	routerAdmin: router_admin,
	routerApi: router_api,
	routerIO: router_io,
	routerListeners: router_listeners
};