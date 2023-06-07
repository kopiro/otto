import { AIAction } from "../../types";

export const id = "count.to";

const countTo: AIAction = function* ({ queryResult }) {
  const { parameters: p } = queryResult || {};
  if (!p?.fields?.to) throw new Error("Missing parameter 'to'");
  for (let i = 1; i <= Number(p.fields.to.numberValue); i++) {
    yield { text: i.toString() };
  }
};

export default countTo;
