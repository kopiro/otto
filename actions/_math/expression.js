exports.id = 'math.expression';

const _config = config.ai.wolfram;

var Wolfram = require('node-wolfram');
var wolframApi = new Wolfram(_config.appId);

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		wolframApi.query(p.q, (err, result) => {
			if (err) {
				return resolve({ 
					speech: 'Non riesco a fare questo calcolo per te' 
				});
			}
		
			if (result.queryresult.pod) {
				for (let i = 0; i < result.queryresult.pod.length; i++) {
					let pod = result.queryresult.pod[i];
					if (pod.$.title === 'Result') {
						return resolve({ 
							speech: pod.subpod[0].plaintext[0] 
						});
					}
				}
			}

			const dym = result.queryresult.didyoumeans;
			if (dym && dym[0].didyoumean[0]._) {
				console.debug(exports.id, 're-quering with didyoumean');
				module.exports({
					entities: {
						q: dym[0].didyoumean[0]._
					}
				})
				.then(resolve)
				.catch(reject);
				return;
			}

		});
	});
};