import { AIAction, Fulfillment } from "../../types";

export const id = "repeat";

const repeat: AIAction = async ({ queryResult }) => {
  const { parameters: p } = queryResult;
  return p.q;
};

export default repeat;
