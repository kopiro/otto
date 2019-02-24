exports.id = 'shutdown.now';

const { exec } = require('child_process');

module.exports = function ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;
  exec('shutdown now', (err, stdout, stderr) => {});
  return fulfillmentText;
};
