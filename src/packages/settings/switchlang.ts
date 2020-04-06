import _ from "underscore";
import levenshtein from "fast-levenshtein";
import config from "../../config";
import * as Translator from "../../interfaces/translator";
import { extractWithPattern } from "../../helpers";
import { Fulfillment } from "../../types";

export const id = "settings.switchlang";

export default async ({ queryResult }, session): Promise<Fulfillment> => {
  const { parameters: p, fulfillmentMessages } = queryResult;

  // Handle special parameter
  if (p.translateBoth) {
    p.translateFrom = p.translateBoth;
    p.translateTo = p.translateBoth;
  }

  // Get languages every time the original language (IT),
  // because all input requests are translated, and the language is translated too!
  // Example: "ние говорим английски" --> "Parliamo in inglese"
  // So we should request the languages in Italiano to match "inglese"
  const languages = await Translator.getLanguages(config().language);

  for (const x of ["From", "To"]) {
    const langReq = p[`translate${x}`];
    if (!langReq) continue;

    let prefLang = {
      distance: 999,
      code: null,
      name: null,
    };

    for (const l of languages) {
      const lev = levenshtein.get(l.name.toUpperCase(), langReq.toUpperCase());
      if (lev < 4 && prefLang.distance > lev) {
        prefLang = {
          distance: lev,
          code: l.code,
          name: l.name,
        };
      }
    }

    if (prefLang.code == null) {
      throw new Error("UNKOWN_LANGUAGE");
    }

    let langToSet = prefLang.code;
    if (langToSet === config().language) {
      langToSet = null;
    }

    session[`translate${x}`] = langToSet;
  }

  await session.save();

  const from = languages.filter((e) => e.code === session.getTranslateFrom())[0]?.name;
  const to = languages.filter((e) => e.code === session.getTranslateTo())[0]?.name;

  let fulfillmentText;

  if (session.getTranslateFrom() === session.getTranslateTo()) {
    fulfillmentText = extractWithPattern(fulfillmentMessages, "[].payload.text.single").replace("$_language", from);
  } else {
    fulfillmentText = extractWithPattern(fulfillmentMessages, "[].payload.text.plural")
      .replace("$_from", from)
      .replace("$_to", to);
  }

  return {
    fulfillmentText,
    payload: {
      language: session.getTranslateTo(),
    },
  };
};
