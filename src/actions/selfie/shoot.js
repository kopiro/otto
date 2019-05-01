exports.id = 'selfie.shoot';

const Selfie = require('../../lib/selfie');
const Server = require('../../lib/server');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  const file = await Selfie.create(p.location || 'Iceland');
  const fileUrl = Server.getURIFromFSFilePath(file);

  return {
    payload: {
      image: {
        uri: fileUrl,
      },
    },
  };
};
