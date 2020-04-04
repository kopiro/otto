import rp from "request-promise";

import * as Translator from "../../lib/translator";
import { rand } from "../../helpers";

export const id = "catfacts";

const API_EP = "https://cat-fact.herokuapp.com/facts";

export default async function main(body, session) {
  const facts = await rp(API_EP, {
    json: true,
  });
  let fact = rand(facts.all);
  fact = await Translator.translate(fact.text, session.getTranslateTo(), "en");
  return fact;
}
