import config from "../../config";
import translator from "../../stdlib/translator";
import { AIAction, Fulfillment } from "../../types";

export const id = "translate.text";

const translateText: AIAction = async ({ queryResult }): Promise<Fulfillment> => {
  const { parameters: p } = queryResult || {};
  if (!p?.fields?.q?.stringValue) throw new Error("Missing parameter 'q'");

  const languages = await translator().getLanguages();
  const language = languages.find((e) => e.name === p?.fields?.language?.stringValue);
  if (!language) throw new Error("Language not found");

  const text = await translator().translate(p?.fields?.q.stringValue, language.code, config().language);
  return {
    text,
    options: {
      includeVoice: true,
      language: language.code,
    },
  };
};

export default translateText;
