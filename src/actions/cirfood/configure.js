exports.id = 'cirfood.configure';

const CirFood = require('cir-food');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;

	const c = new CirFood(p.username, p.password);

	try {		
		c.login();
		session.saveSettings({
			cirfood: p
		});
		return {
			speech: fulfillment.speech
		};
	} catch (ex) {
		throw fulfillment.payload.error;
	}
	
};