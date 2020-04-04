import * as Proc from "../../lib/proc";
import { Fulfillment } from "../../types";

export const id = "shutdown.now";

export default async function main({ queryResult }): Promise<Fulfillment> {
  const { fulfillmentText } = queryResult;
  Proc.spawn("shutdown", ["now"]);
  return fulfillmentText;
}
