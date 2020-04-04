import Moment from "../../lib/moment";

export const id = "datetime.now";

export default async function main({ queryResult }) {
  const { fulfillmentText } = queryResult;
  return fulfillmentText.replace("$_time", Moment().format("LT"));
}
