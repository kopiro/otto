exports.id = "datetime.now";

const Moment = require("../../lib/moment");

module.exports = async function main({ queryResult }) {
  const { fulfillmentText } = queryResult;
  return fulfillmentText.replace("$_time", Moment().format("LT"));
};
