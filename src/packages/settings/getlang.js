exports.id = "settings.switchlang";

const _ = require("underscore");
const config = require("../../config");
const Translator = require("../../lib/translator");

module.exports = async function main({ queryResult }, session) {
  const { fulfillmentText } = queryResult;

  const languages = await Translator.getLanguages(config.language);
  const from = _.findWhere(languages, { code: session.getTranslateFrom() })
    .name;
  const to = _.findWhere(languages, { code: session.getTranslateTo() }).name;

  return fulfillmentText.replace("$_from", from).replace("$_to", to);
};
