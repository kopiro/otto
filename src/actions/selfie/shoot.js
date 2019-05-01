exports.id = 'selfie.shoot';

const Selfie = require('../../lib/selfie');
const Server = require('../../stdlib/server');

module.exports = async function main({ queryResult }) {
  const { parameters: p } = queryResult;

  const file = await Selfie.create(p.location);
  const fileUrl = Server.getURIFromFSFilePath(file);

  return {
    payload: {
      image: {
        uri: fileUrl,
      },
    },
  };
};
