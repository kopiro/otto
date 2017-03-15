const TAG = 'IO.API';
const API = require(__basedir + '/support/httpapi');

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = path.basename(__filename, '.js');
exports.capabilities = { 
	userCanViewUrls: true
};

function tmpFileToHttp(req, file) {
	return config.server.fullDomain + '/tmp/' + path.basename(file);
}

exports.startInput = function() {
	// singleton event
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	console.info(TAG, 'start');

	API.get('/input', (req, res) => {
		const data = { 
			req: req, 
			res: res
		};

		if (req.query.text) {
			exports.emitter.emit('input', {
				data: data,
				params: {
					text: req.query.text
				}
			});
		} else {
			res.json({
				error: {
					unkownInputType: true,
					message: 'Unknown input type'
				}
			});
		}
	});
};

exports.output = function({ data, params }) {
	console.ai(TAG, 'output', params);

	return new Promise((resolve, reject) => {
		let { req, res } = data;
		const outputas = req.query.outputas || 'text';

		if (params.error) {
			res.json(params);
			return resolve();
		}

		if (params.text) {
			switch (outputas) {

				case 'text':
				res.json(params);
				break;

				case 'voice':
				require(__basedir + '/support/lumenvoxhack')
				.playToFile(params.text, (err, file) => {
					if (err) return res.json({ error: err });
					return res.json(_.extend(params, {
						voice: tmpFileToHttp(req, file)
					}));
				});
				break;

				default:
				res.json({
					error: {
						unkownOutputasType: true
					}
				});
				break;

			} 
			return resolve();
		}

		if (params.media) {
			if (params.media.track) {
				res.json(params);
				return resolve();
			}
		}

		if (params.photo) {
			res.json(params);
			return resolve();
		}

		if (params.lyrics) {
			res.json(params);
			return resolve();
		}

		res.json({ 
			error: {
				message: 'Unhandled output',
				unkownOutputType: true
			}
		});
		return reject({ unkownOutputType: true });
	});
};