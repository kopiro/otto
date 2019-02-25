exports.id = 'geo.capital';

const rp = require('request-promise');

const Translator = requireLibrary('translator');

module.exports = async function ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  const country_en = await Translator.translate(p.country, 'en');
  const info = await rp(`https://restcountries.eu/rest/v2/name/${country_en}`, {
    json: true,
  });

  return fulfillmentText.replace('$_capital', info[0].capital);
};
