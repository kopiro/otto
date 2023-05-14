import config from "../../config";
import translator from "../../stdlib/translator";
import { AIAction } from "../../types";

export const id = "settings.availablelangs";

const availableLangs: AIAction = async () => {
  const languages = await translator().getLanguages();
  return { text: languages.map((e) => e.name).join(", ") };
};

export default availableLangs;
