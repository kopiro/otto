exports.id = "shutdown.restart";

const Proc = require("../../lib/proc");

module.exports = function main({ queryResult }) {
  const { fulfillmentText } = queryResult;
  Proc.spawn("reboot");
  return fulfillmentText;
};
