exports.id = 'spotify.configure';

const spotify = require('../../lib/spotify');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p, queryText, fulfillmentText } = queryResult;
  return {
    payload: {
      url: spotify.getAuthorizeUrl(session),
    },
  };
};
