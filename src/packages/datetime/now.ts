import moment from "../../lib/moment";
import { Fulfillment } from "../../types";

export const id = "datetime.now";

export default function main({ queryResult }): Fulfillment {
  const { fulfillmentText } = queryResult;
  return { text: fulfillmentText.replace("$_time", moment()().format("LT")) };
}
