const TAG = 'Wolfram';

const _config = config.wolfram;

const _ = require('underscore');
const Wolfram = require('node-wolfram');
const Translator = apprequire('translator');

const $ = new Wolfram(_config.appId);

$.complexQuery = function(q, language) {
	return new Promise(async(resolve, reject) => {
		
		const q_translated = await Translator.translate(q, 'en');
		
		$.query(q_translated, async(err, result) => {
			if (err) {
				console.error(TAG, q_translated, err);
				return reject(err);
			}

			let pod = _.find(result.queryresult.pod, (p) => {
				console.info(TAG, p.$, p.subpod[0].plaintext[0]);
				return p.$.primary;
			});

			if (pod == null) {
				pod = _.find(result.queryresult.pod, (p) => {
					return p.$.id === 'NotableFacts:PeopleData';
				});
			}

			if (pod == null) {
				const dym = result.queryresult.didyoumeans;
				if (dym && dym[0].didyoumean[0]._) {
					console.debug(TAG, 're-quering with didyoumean');
					let result = await $.complexQuery(dym[0].didyoumean[0]._);
					return resolve(result);
				}
			}

			if (pod == null) {
				return reject({
					notFound: true
				});
			}

			let final_result = pod.subpod[0].plaintext[0];
			final_result = await Translator.translate(final_result, language, 'en');
			resolve(final_result);
		});
	});
};

module.exports = $;