exports.id = 'scf.start';

const _ = require('underscore');
const GAME_VALUES = [
	{ key: 's', value: 'Sasso' },
	{ key: 'c', value: 'Carta' },
	{ key: 'f', value: 'Forbice' }
];

module.exports = function({ sessionId, result }, session) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		let userAnswer = p.q;
		let aiAnswer = getRandomElement(GAME_VALUES);

		resolve({
			speech: aiAnswer.value,
			contextOut: [
			{ name: "scf_game", lifespan: 1 }
			]
		});
	});
};