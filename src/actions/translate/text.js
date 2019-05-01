exports.id = 'translate.text';

const _ = require('underscore');

const Translator = require('../../lib/translator');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p } = queryResult;

  const languages = await Translator.getLanguages(config.language);
  const language = _.findWhere(languages, { name: p.language });
  if (language == null) {
    throw {
      message: 'unknown_language',
      data: {
        language: p.language,
      },
    };
  }

  const text = await Translator.translate(p.q, language.code);
  return {
    fulfillmentText: text,
    payload: {
      includeVoice: true,
      language: language.code,
    },
  };
};
