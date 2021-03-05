import config from "../../config";
import Translator from "../../stdlib/translator";
import { Fulfillment } from "../../types";

export const id = "settings.availablelangs";

export default async (): Promise<Fulfillment> => {
  const languages = await Translator.getLanguages(config().language);
  return { text: languages.map((e) => e.name).join(", ") };
};
