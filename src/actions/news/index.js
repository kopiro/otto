exports.id = 'news';

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;

	const body = IOManager.decodeBody(fulfillment);

	return {
		speech: body.title
	};
};