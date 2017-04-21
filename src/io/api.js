const TAG = 'IO.API';
const Server = apprequire('server').routerApi;

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'api';

function tmpFileToHttp(req, file) {
	return (config.server.fullDomain || '') + '/tmp/' + path.basename(file);
}

exports.startInput = function() {
	// singleton event
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	console.info(TAG, 'start');

	Server.get('/input', (req, res) => {
		const sessionId = req.query.sessionId || require('node-uuid').v4();
		const data = { 
			express: {
				req: req, 
				res: res
			},
			sessionId: sessionId
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

exports.output = function({ data, fulfillment:f }) {
	console.info(TAG, 'output', data, f);
	f.data = f.data || {};

	return new Promise((resolve, reject) => {
		let { req, res } = data.express;
		const outputas = req.query.outputas || 'text';

		if (f.error) {
			res.json(f);
			return resolve();
		}

		if (f.speech) {
			switch (outputas) {

				case 'text':
				res.json(f);
				break;

				case 'voice':
				apprequire('polly')
				.playToTmpFile(f.speech, (err, file) => {
					if (err) return res.json({ error: err });
					return res.json(_.extend(f, {
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

		if (f.data.media) {
			res.json(f);
		}

		if (f.data.image) {
			res.json(f);
			return resolve();
		}

		if (f.data.lyrics) {
			res.json(f);
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