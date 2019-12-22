const { addInput } = require("./helpers");

module.exports = async ({ queryResult }) => {
  const { parameters, fulfillmentText } = queryResult;
  const { name, unit, category, quantity } = parameters;

  await addInput(name, category, quantity, unit);
  return fulfillmentText;
};
