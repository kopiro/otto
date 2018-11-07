exports.id = 'datetime.now';

const Moment = apprequire('moment');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	return fulfillmentText.replace('$_time', Moment().format('LT'));
};
