const TAG = 'Wolfram';

const _config = config.wolfram;

const _ = require('underscore');
const { promisify } = require('util');

const Wolfram = require('node-wolfram');

const $ = new Wolfram(_config.appId);

$._query = $.query;
$.query = function (q) {
  return new Promise((resolve, reject) => {
    $._query(q, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    });
  });
};

// $.complexQuery = async function(q) {
// 	const result = await promisify($.query)(q);
// 			if (err) {
// 				return reject(err);
// 			}

// 			let pod = _.find(result.queryresult.pod, p => {
// 				console.info(TAG, p.$, p.subpod[0].plaintext[0]);
// 				return p.$.primary;
// 			});

// 			if (pod == null) {
// 				pod = _.find(result.queryresult.pod, p => {
// 					return p.$.id === 'NotableFacts:PeopleData';
// 				});
// 			}

// 			if (pod == null) {
// 				const dym = result.queryresult.didyoumeans;
// 				if (dym && dym[0].didyoumean[0]._) {
// 					console.debug(TAG, 're-quering with didyoumean');
// 					let result = await $.complexQuery(dym[0].didyoumean[0]._);
// 					return resolve(result);
// 				}
// 			}

// 			if (pod == null) {
// 				return reject({
// 					notFound: true
// 				});
// 			}

// 			let final_result = pod.subpod[0].plaintext[0];
// 			final_result = await Translator.translate(final_result, language, 'en');
// 			resolve(final_result);
// 		});
// };

module.exports = $;
