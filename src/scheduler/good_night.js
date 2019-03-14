const AI = require('../stdlib/ai');

function run({ session }) {
  return AI.processInput({ event: 'good_night', session });
}

module.exports = {
  run,
};
