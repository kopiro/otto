const _config = config.server;

const port = _config.port;

const http = require('http');
const express = require('express');
const app = express();

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const exphbs  = require('express-handlebars');

app.set('title', require(__basedir + '/package.json').name);
app.set('views', __basedir + '/web/views');
app.set('view engine', 'handlebars');

app.engine('handlebars', exphbs({ 
	defaultLayout: 'main',
	layoutsDir: __basedir + '/web/views/layouts',
	partialsDir: __basedir + '/web/views/partials'
}));

////////////
// Router //
////////////

const router_api = express.Router();
router_api.use(require('body-parser').json());
router_api.use(require('body-parser').urlencoded({
	extended: true
}));

router_api.get('/', (req, res) => {
	res.json({
		name: 'otto-ai',
		version: 1
	});
});

///////////
// Admin //
///////////

const router_admin = express.Router();

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
app.use(express.static(__basedir + '/public'));

// tmp
app.use('/tmp', express.static(__basedir + '/tmp'));

// dynamics
app.use('/api', router_api);
app.use('/admin', router_admin);
app.use('/awh', router_awh);
app.use('/actions', router_actions);

// Start
server.listen(port, () => {
	console.info(`HTTP Server has started on port ${port}`);
});

module.exports = {
	app: app,
	io: io,
	routerActions: router_actions,
	routerAdmin: router_admin,
	routerApi: router_api,
	routerAwh: router_awh
};