import { Fulfillment } from "../../types";

export const id = "repeat";

export default async ({ queryResult }): Promise<Fulfillment> => {
  const { parameters: p } = queryResult;
  return p.q;
};
