export default async function ({ queryResult }) {
  const { fulfillmentText } = queryResult;
  return fulfillmentText.replace("$_platform", process.platform);
}
