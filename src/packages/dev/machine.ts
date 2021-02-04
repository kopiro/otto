import { Fulfillment } from "../../types";

export default function ({ queryResult }): Fulfillment {
  const { fulfillmentText } = queryResult;
  return { text: fulfillmentText.replace("$_platform", process.platform) };
}
