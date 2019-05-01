exports.id = 'shutdown.now';

const Proc = require('../../lib/proc');

module.exports = function main({ queryResult }) {
  const { fulfillmentText } = queryResult;
  Proc.spawn('shutdown now');
  return fulfillmentText;
};
