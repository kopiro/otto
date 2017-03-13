const _config = config.server;

const port = _config.port;

const http = require('http');
const express = require('express');
const app = express();

const router = express.Router();

router.use(require('body-parser').urlencoded({
	extended: true
}));

router.get('/', (req, res) => {
	res.json({
		name: 'otto-ai',
		version: 1
	});
});

app.use(express.static(__basedir + '/public'));
app.use('/tmp', express.static(__basedir + '/tmp'));
app.use('/api', router);

app.listen(port, () => {
	console.info(`API HTTP Server has started on port ${port}`);
});

module.exports = router;