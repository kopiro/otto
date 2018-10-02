exports.id = 'gocrazy';

const _ = require('underscore');
const fs = require('fs');
const spawn = require('child_process').spawn;

const Translator = apprequire('translator');
const ImagesClient = require('google-images');
const client = new ImagesClient(config.gcloud.cseId, config.gcloud.apiKey);

module.exports = function({ sessionId, result }, session) {
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;
		resolve();

		setTimeout(() => {
			Data.SessionInput
			.find({}, { _id: false, text: true })
			.then((_inputs) => {
			
				let inputs = [];
				_inputs.forEach((i) => {
					i.text.split(' ').forEach((t) => {
						inputs.push(t); 
					});
				});				

				fs.writeFile(__tmpdir + '/dadadodo.txt', inputs.join(' '), () => {
					let index = 0;
					function _next() {
						if (index++ > 10) return;

						const what = _.random(0, 10);
						console.log(exports.id, 'output', what);

						if (what < 8) {
							let text = '';
							const prc = spawn('dadadodo', [ '-c', 1, __tmpdir + '/dadadodo.txt' ]);
							prc.stdout.on('data', (_text) => { text += _text.toString(); });
							prc.on('close', () => {
								IOManager.handle({ 
									fulfillment: {
										speech: text.toString()
									},
									session: session
								});
								_next();
							});
						} else if (what >= 8) {
							const w = rand(inputs);
							client.search(`disegno "${w}"`)
							.then((images) => {
								IOManager.output({
									data: { 
										image: { 
											uri: rand(images).url 
										} 
									}
								}, session);
								_next();
							});
						}
					}
					_next();
				});

			});
		}, 0);
	});
};

