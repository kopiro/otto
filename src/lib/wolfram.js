const TAG = 'Wolfram';

const Wolfram = require('node-wolfram');
const _config = config.ai.wolfram;

const $ = new Wolfram(_config.appId);

$.complexQuery = function(q) {
	return new Promise((resolve, reject) => {
		$.query(q, (err, result) => {
			if (err) {
				console.error(TAG, err);
				return reject(err);
			}

			console.debug(TAG, q, result);

			if (result.queryresult.pod) {
				for (let i = 0; i < result.queryresult.pod.length; i++) {
					let pod = result.queryresult.pod[i];
					if (pod.$.title === 'Result') {
						return resolve(pod.subpod[0].plaintext[0]);
					}
				}
			}

			const dym = result.queryresult.didyoumeans;
			if (dym && dym[0].didyoumean[0]._) {
				console.debug(TAG, 're-quering with didyoumean');

				return $.complexQuery(dym[0].didyoumean[0]._)
				.then(resolve)
				.catch(reject);
			}
		});
	});
};

module.exports = $;