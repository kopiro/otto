import config from "../../config";
import translator from "../../stdlib/translator";
import { Fulfillment, Session } from "../../types";

export const id = "settings.switchlang";

export default async ({ queryResult }, session: Session): Promise<Fulfillment> => {
  const languages = await translator().getLanguages(config().language);
  const from = languages.find((e) => e.code === session.getTranslateFrom())?.name;
  const to = languages.find((e) => e.code === session.getTranslateTo())?.name;

  const { fulfillmentText } = queryResult;
  return {
    text: fulfillmentText.replace("$_from", from).replace("$_to", to),
  };
};
