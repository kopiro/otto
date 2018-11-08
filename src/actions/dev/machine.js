exports.id = 'dev.machine';

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	return fulfillmentText.replace('$_platform', process.platform);
};
