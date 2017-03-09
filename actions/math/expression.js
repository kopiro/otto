const _config = config.ai.wolfram;
const TAG = path.basename(__filename, '.js');

var Wolfram = require('node-wolfram');
var wolframApi = new Wolfram(_config.appId);

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.info(TAG, e);

		let { parameters:p, fulfillment, resolvedQuery } = e;

		wolframApi.query(p.q, (err, result) => {
			if (err) return reject({ text: 'Non riesco a fare questo calcolo per te' });
		
			if (result.queryresult.pod) {
				for (let i = 0; i < result.queryresult.pod.length; i++) {
					let pod = result.queryresult.pod[i];
					if (pod.$.title === 'Result') {
						return resolve({ 
							text: pod.subpod[0].plaintext[0] 
						});
					}
				}
			}

			const dym = result.queryresult.didyoumeans;
			if (dym && dym[0].didyoumean[0]._) {
				console.debug(TAG, 're-quering with didyoumean');
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