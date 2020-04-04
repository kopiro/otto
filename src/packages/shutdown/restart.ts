import * as Proc from "../../lib/proc";
import { Fulfillment } from "../../types";

export const id = "shutdown.restart";

export default async function main({ queryResult }): Promise<Fulfillment> {
  const { fulfillmentText } = queryResult;
  Proc.spawn("reboot");
  return fulfillmentText;
}
