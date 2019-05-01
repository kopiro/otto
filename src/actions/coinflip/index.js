exports.id = 'coinflip';

module.exports = async function main ({ sessionId, result }) {
  return {
    fulfillmentText: rand(['Testa', 'Croce']),
  };
};
