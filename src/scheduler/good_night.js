const AI = require("../stdlib/ai");

function run({ session }) {
  return AI.processInput({ params: { event: "good_night" }, session });
}

module.exports = {
  run
};
