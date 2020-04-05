import request from "request-promise";
import { rand } from "../../helpers";
import { AIAction } from "../../types";

export const id = "catfacts";

const API_EP = "https://cat-fact.herokuapp.com/facts";

export default (async function main() {
  const facts = await request(API_EP, {
    json: true,
  });
  const fact = rand(facts.all);
  return {
    fact,
    payload: {
      translateFrom: "en",
    },
  };
} as AIAction);
