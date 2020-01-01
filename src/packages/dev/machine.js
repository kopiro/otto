module.exports = async ({ queryResult }) => {
  const { fulfillmentText } = queryResult;
  return fulfillmentText.replace("$_platform", process.platform);
};
