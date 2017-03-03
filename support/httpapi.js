const _config = config.server;

const port = _config.port;

const http = require('http');
const express = require('express');
const app = express();

const router = express.Router();

router.use(require('body-parser').urlencoded({
	extended: true
}));

app.use(express.static(__basedir + '/public'));
app.use('/api', router);

app.listen(port, () => {
	console.info(`Server has started on port ${port}`);
});

module.exports = router;