exports.id = 'cirfood.configure';

const CirFood = require('cir-food');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;

	const c = new CirFood(p.username, p.password);

	await c.login();
	await session.saveSettings({ cirfood: p });

	return fulfillmentText;
};
