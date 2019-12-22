const { replaceVariablesInStrings } = require("../../helpers");
const { getStockQuantityFor } = require("./helpers");

module.exports = async ({ queryResult }) => {
  const { parameters, fulfillmentText } = queryResult;
  const { name } = parameters;
  const stock = await getStockQuantityFor(name);
  return replaceVariablesInStrings(fulfillmentText, stock[0]);
};
