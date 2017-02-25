const _config = config.ai.wolfram;
const TAG = path.basename(__filename, '.js');

var Wolfram = require('node-wolfram');
var wolframApi = new Wolfram(_config.appId);

module.exports = function calculateMathExpr(request) {
	return new Promise(function(resolve, reject) {
		var query = request.entities.math_expression[0].value;
		console.info('AI.calculateMathExpr', query);

		wolframApi.query(query, function(err, result) {
			try {
				if (err) throw err;

				if (result.queryresult.pod) {
					for (let i = 0; i < result.queryresult.pod.length; i++) {
						let pod = result.queryresult.pod[i];
						if (pod.$.title === 'Result') {
							resolve({ result: pod.subpod[0].plaintext[0] });
							return;
						}
					}
				} else if (result.queryresult.didyoumeans && result.queryresult.didyoumeans[0].didyoumean[0]._) {

					console.info('AI.calculateMathExpr', 're-quering with didyoumean');
					calculateMathExpr({
						sessionId: request.sessionId,
						entities: {
							math_expression: [ { value: result.queryresult.didyoumeans[0].didyoumean[0]._ } ]
						}
					})
					.then(resolve)
					.catch(function() {
						reject({ 
							sessionId: request.sessionId,
							text: 'Non riesco a fare questo calcolo per te' 
						});
					});

				} else {
					throw {};
				}

			} catch (ex) {
				console.error('AI.calculateMathExpr', ex);
				reject({ 
					sessionId: request.sessionId,
					text: 'Non riesco a fare questo calcolo per te' 
				});
			}
		});
	});
};