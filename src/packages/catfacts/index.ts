import request from "request-promise";
import { rand } from "../../helpers";
import { Fulfillment } from "../../types";

export const id = "catfacts";

const API_EP = "https://cat-fact.herokuapp.com/facts";

export default async (): Promise<Fulfillment> => {
  const facts = await request(API_EP, {
    json: true,
  });
  const fact = rand(facts.all);
  return {
    fulfillmentText: fact,
    payload: {
      translateFrom: "en",
    },
  };
};
