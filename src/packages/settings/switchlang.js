exports.id = "settings.switchlang";

const _ = require("underscore");
const levenshtein = require("fast-levenshtein");
const config = require("../../config");
const Translator = require("../../lib/translator");
const { extractWithPattern } = require("../../helpers");

module.exports = async function main({ queryResult }, session) {
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

  for (const x of ["from", "to"]) {
    const langReq = p[`translate_${x}`];
    if (langReq == null) continue;

    let prefLang = {
      distance: 999,
      code: null,
      name: null
    };

    for (const l of languages) {
      const lev = levenshtein.get(l.name.toUpperCase(), langReq.toUpperCase());
      if (lev < 4 && prefLang.distance > lev) {
        prefLang = {
          distance: lev,
          code: l.code,
          name: l.name
        };
      }
    }

    if (prefLang.code == null) {
      throw new Error("unkown_language");
    }

    let langToSet = prefLang.code;
    if (langToSet === config.language) langToSet = null;
    session[`translate_${x}`] = langToSet;
  }

  await session.save();

  const from = _.findWhere(languages, { code: session.getTranslateFrom() })
    .name;
  const to = _.findWhere(languages, { code: session.getTranslateTo() }).name;

  if (session.getTranslateFrom() === session.getTranslateTo()) {
    return extractWithPattern(
      fulfillmentMessages,
      "[].payload.text.single"
    ).replace("$_language", from);
  }

  return extractWithPattern(fulfillmentMessages, "[].payload.text.plural")
    .replace("$_from", from)
    .replace("$_to", to);
};