exports.id = '__example';

module.exports = function ({ sessionId, result }) {
  return new Promise((resolve, reject) => {
    const { parameters: p, fulfillment } = result;
    resolve({
      speech: 'Text to speech',
    });
  });
};
