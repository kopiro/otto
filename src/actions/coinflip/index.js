exports.id = 'coinflip';

module.exports = async function({ sessionId, result }) {
	return {
		fulfillmentText: rand(['Testa', 'Croce'])
	};
};
