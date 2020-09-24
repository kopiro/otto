import config from "../../config";
import Translator from "../../stdlib/translator";
import { Fulfillment } from "../../types";

export const id = "settings.switchlang";

export default async ({ queryResult }, session): Promise<Fulfillment> => {
  const languages = await Translator.getLanguages(config().language);
  const from = languages.find((e) => e.code === session.getTranslateFrom())?.name;
  const to = languages.find((e) => e.code === session.getTranslateTo())?.name;

  let { fulfillmentText } = queryResult;
  fulfillmentText = fulfillmentText.replace("$_from", from).replace("$_to", to);

  return {
    fulfillmentText,
  };
};
