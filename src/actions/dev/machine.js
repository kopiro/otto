exports.id = 'dev.machine';

module.exports = async function main({ queryResult }) {
  const { fulfillmentText } = queryResult;
  return fulfillmentText.replace('$_platform', process.platform);
};
