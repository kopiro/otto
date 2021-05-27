import config from "../../config";
import translator from "../../stdlib/translator";

export const id = "translate.text";

export default async function main({ queryResult }) {
  const { parameters: p } = queryResult;

  const languages = await translator().getLanguages(config().language);
  const language = languages.find((e) => e.name === p.language);

  if (!language) {
    return {
      fulfillmentText: `Non riconosco questa lingua: ${p.language}`,
    };
  }

  const text = await translator().translate(p.q, language.code, config().language);
  return {
    fulfillmentText: text,
    payload: {
      includeVoice: true,
      language: language.code,
    },
  };
}
