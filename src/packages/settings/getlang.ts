import config from "../../config";
import translator from "../../stdlib/translator";
import { AIAction, Session } from "../../types";

export const id = "settings.switchlang";

const getLang: AIAction = async ({ queryResult }, session: Session) => {
  const languages = await translator().getLanguages();
  const from = languages.find((e) => e.code === session.getTranslateFrom())?.name;
  const to = languages.find((e) => e.code === session.getTranslateTo())?.name;

  const { fulfillmentText } = queryResult;
  return {
    text: fulfillmentText.replace("$_from", from).replace("$_to", to),
  };
};

export default getLang;
