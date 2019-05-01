exports.id = 'settings.availablelangs';

const _ = require('underscore');

const Translator = require('../../lib/translator');

module.exports = async function main({ queryResult }, session) {
  const languages = await Translator.getLanguages(config.language);
  return _.pluck(languages, 'name').join(', ');
};
