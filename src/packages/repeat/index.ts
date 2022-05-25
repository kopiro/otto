import { AIAction } from "../../types";

export const id = "repeat";

const repeat: AIAction = async ({ queryResult }) => {
  const { parameters: p } = queryResult;
  return { text: p.fields.q.stringValue };
};

export default repeat;
