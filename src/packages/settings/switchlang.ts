import levenshtein from "fast-levenshtein";
import config from "../../config";
import translator from "../../stdlib/translator";
import { Session, AIAction } from "../../types";

export const id = "settings.switchlang";

const switchLang: AIAction = async ({ queryResult }, session: Session) => {
  const { parameters: p } = queryResult;

  let translateFrom = p?.fields?.translateFrom.stringValue;
  let translateTo = p?.fields?.translateTo.stringValue;

  // Handle special parameter
  if (p.fields.translateBoth?.stringValue) {
    translateFrom = p?.fields?.translateBoth.stringValue;
    translateTo = p?.fields?.translateBoth.stringValue;
  }

  // Get languages every time the original language (IT),
  // because all input requests are translated, and the language is translated too!
  // Example: "ние говорим английски" --> "Parliamo in inglese"
  // So we should request the languages in Italiano to match "inglese"
  const languages = await translator().getLanguages(config().language);

  for (const [attr, langReq] of [
    ["translateFrom", translateFrom],
    ["translateTo", translateTo],
  ]) {
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

    session[attr] = langToSet;
  }

  await session.save();

  return {
    text: queryResult.fulfillmentText,
    options: {
      language: session.getTranslateTo(),
    },
  };
};

export default switchLang;
