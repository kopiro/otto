const { getModels } = require("../../lib/hotword");

module.exports = async ({ queryResult }) => {
  const { fulfillmentText } = queryResult;
  await getModels(true);
  return fulfillmentText;
};
