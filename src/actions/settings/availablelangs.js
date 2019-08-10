exports.id = 'settings.availablelangs';

const _ = require('underscore');
const config = require('../../config');
const Translator = require('../../lib/translator');

module.exports = async function main() {
  const languages = await Translator.getLanguages(config.language);
  return _.pluck(languages, 'name').join(', ');
};
