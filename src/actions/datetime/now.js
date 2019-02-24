exports.id = 'datetime.now';

const Moment = apprequire('moment');

module.exports = async function ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;
  return fulfillmentText.replace('$_time', Moment().format('LT'));
};
