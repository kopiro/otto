const TAG = 'IO.API';
const API = require(__basedir + '/support/httpapi');

exports.capabilities = { 
	userCanViewUrls: true
};

let callback;

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	// singleton event
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	console.info(TAG, 'start');

	API.get('/api/request', (req, res) => {
		let data = { req: req, res: res };
		callback(null, data, {
			text: req.query.text
		});
	});
};

exports.output = function(data, e) {
	e = e || {};
	console.ai(TAG, e);

	return new Promise((resolve, reject) => {
		if (_.isString(e)) e = { text: e };
		let { req, res } = data;

		if (e.text) {
			res.json(e);
			return resolve();
		}

		if (e.spotify) {
			if (e.spotify.song) {
				res.json(e);
				return resolve();
			}
		}

		if (e.photo) {
			res.json(e);
			return resolve();
		}

		res.json({ 
			error: {
				message: e.error || 'Unhandled output',
				exception: e.exception || {}
			}
		});
		reject();
	});
};