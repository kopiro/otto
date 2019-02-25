exports.id = 'settings.switchlang';

const _ = require('underscore');

const Translator = requireLibrary('translator');

module.exports = async function ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  const languages = await Translator.getLanguages(config.language);
  const from = _.findWhere(languages, { code: session.getTranslateFrom() })
    .name;
  const to = _.findWhere(languages, { code: session.getTranslateTo() }).name;

  return fulfillmentText.replace('$_from', from).replace('$_to', to);
};
