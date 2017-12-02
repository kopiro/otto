const _config = config.server;

const port = _config.port;

const http = require('http');
const socketio = require('socket.io');
const express = require('express');
const app = express();

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

////////////
// Router //
////////////

const router_api = express.Router();
router_api.use(require('body-parser').json());
router_api.use(require('body-parser').urlencoded({
	extended: true
}));

router_api.get('/', (req, res) => {
	const p = require(__basedir + '/package.json');
	res.json({
		name: p.name,
		version: p.version
	});
});

///////////
// Admin //
///////////

const router_admin = express.Router();

///////////
// Client //
///////////

const router_client = express.Router();

////////////////////
// API.AI webhook //
////////////////////

const router_awh = express.Router();
router_awh.use(require('body-parser').json());
router_awh.use(require('body-parser').urlencoded({
	extended: true
}));

//////////////////
// Actions part //
//////////////////

const router_actions = express.Router();

///////////
// Mount //
///////////

// public
app.use(express.static(__basedir + '/server/public'));

// tmp
app.use('/tmp', express.static(__basedir + '/tmp'));

// dynamics
app.use('/api', router_api);
app.use('/admin', router_admin);
app.use('/awh', router_awh);
app.use('/actions', router_actions);
app.use('/client', router_client);

// Start
server.listen({ port: port, server: '0.0.0.0' }, (e) => {
	console.info(`HTTP Server has started on port ${port}`);
});

module.exports = {
	app: app,
	io: io,
	routerActions: router_actions,
	routerAdmin: router_admin,
	routerApi: router_api,
	routerAwh: router_awh,
	routerClient: router_client
};