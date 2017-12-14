exports.id = 'scf.start';

const _ = require('underscore');

module.exports = function({ sessionId, result }, session) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		resolve({
			speech: result.fulfillment.speech,
			contextOut: [
			{ name: "scf_game", lifespan: 1 }
			]
		});
	});
};