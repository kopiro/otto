const _config = config.server;

const http = require('http');
const express = require('express');
const app = express();

const port = _config.port;

app.use(require('body-parser').urlencoded({
	extended: true
}));

app.listen(port, () => {
	console.info(`Server has started on port ${port}`);
});

module.exports = app;