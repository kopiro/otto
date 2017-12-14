exports.id = 'datetime.now';

const Moment = apprequire('moment');

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;
	const now = Moment().format('LT');
	return {
		speech: `Sono le ${now}`
	};
};