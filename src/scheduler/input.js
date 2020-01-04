const AI = require("../stdlib/ai");

module.exports = function run({ programArgs, session }) {
  return AI.processInput({ params: programArgs, session });
};
