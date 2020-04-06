import config from "../../config";
import * as Translator from "../../interfaces/translator";
import { AIAction } from "../../types";

export const id = "settings.switchlang";

export default (async ({ queryResult }, session) => {
  const languages = await Translator.getLanguages(config().language);
  const from = languages.find((e) => e.code === session.getTranslateFrom())?.name;
  const to = languages.find((e) => e.code === session.getTranslateTo())?.name;

  let { fulfillmentText } = queryResult;
  fulfillmentText = fulfillmentText.replace("$_from", from).replace("$_to", to);

  return {
    fulfillmentText,
  };
}) as AIAction;
