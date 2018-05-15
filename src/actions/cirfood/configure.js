exports.id = 'cirfood.configure';

const CirFood = require('cir-food');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;

	const c = new CirFood(p.username, p.password);

	try {		
		await c.login();
	} catch (ex) {
		throw fulfillment.payload.error;
	}

	session.settings.cirfood = p;
	session.markModified('settings');
	session.save();

	return {
		speech: fulfillment.speech
	};
	
};