exports.id = "coinflip";
const { rand } = require("../../helpers");

module.exports = async function main() {
  return {
    fulfillmentText: rand(["Testa", "Croce"])
  };
};
