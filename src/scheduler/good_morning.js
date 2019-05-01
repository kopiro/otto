const AI = require('../stdlib/ai');

function run({ session }) {
  return AI.processInput({ event: 'good_morning', session });
}

module.exports = {
  run,
};
