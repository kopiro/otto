const AI = require("../stdlib/ai");

module.exports = function run({ programArgs, session }) {
  console.log("programArgs", programArgs);
  return AI.processInput({ params: programArgs, session });
};
