exports.id = 'settings.availablelangs';

const _ = require('underscore');

const Translator = requireLibrary('translator');

module.exports = async function ({ queryResult }, session) {
  const languages = await Translator.getLanguages(config.language);
  return _.pluck(languages, 'name').join(', ');
};
