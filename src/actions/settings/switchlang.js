exports.id = 'settings.switchlang';

const _ = require('underscore');
const levenshtein = require('fast-levenshtein');

const Translator = apprequire('translator');

module.exports = async function ({ queryResult }, session) {
  const { parameters: p, fulfillmentMessages } = queryResult;

  // Handle special parameter
  if (p.translate_both) {
    p.translate_from = p.translate_both;
    p.translate_to = p.translate_both;
  }

  // Get languages every time the original language (IT),
  // because all input requests are translated, and the language is translated too!
  // Example: "ние говорим английски" --> "Parliamo in inglese"
  // So we should request the languages in Italiano to match "inglese"
  const languages = await Translator.getLanguages(config.language);

  for (const x of ['from', 'to']) {
    const language_request = p[`translate_${x}`];
    if (language_request == null) continue;

    let preferred_lang = {
      distance: 999,
      code: null,
      name: null,
    };

    for (const l of languages) {
      const lev = levenshtein.get(
        l.name.toUpperCase(),
        language_request.toUpperCase(),
      );
      if (lev < 4 && preferred_lang.distance > lev) {
        preferred_lang = {
          distance: lev,
          code: l.code,
          name: l.name,
        };
      }
    }

    if (preferred_lang.code == null) {
      throw 'unkown_language';
    }

    let language_to_set = preferred_lang.code;
    if (language_to_set == config.language) language_to_set = null;
    session[`translate_${x}`] = language_to_set;
  }

  await session.save();

  const from = _.findWhere(languages, { code: session.getTranslateFrom() })
    .name;
  const to = _.findWhere(languages, { code: session.getTranslateTo() }).name;

  if (session.getTranslateFrom() === session.getTranslateTo()) {
    return extractWithPattern(
      fulfillmentMessages,
      '[].payload.text.single',
    ).replace('$_language', from);
  }
  return extractWithPattern(fulfillmentMessages, '[].payload.text.plural')
    .replace('$_from', from)
    .replace('$_to', to);
};
