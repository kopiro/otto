const { replaceVariablesInStrings } = require("../../helpers");
const { getStock } = require("./helpers");

module.exports = async ({ queryResult }) => {
  const { fulfillmentText } = queryResult;
  const stock = await getStock();

  const list = stock
    .map(stockByProduct =>
      stockByProduct.map(e => `- ${e.name}: ${e.quantity} ${e.unit}`).join(", ")
    )
    .join("\n");

  return replaceVariablesInStrings(fulfillmentText, { list });
};
