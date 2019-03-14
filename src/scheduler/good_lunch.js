const AI = require('../stdlib/ai');

async function run({ session }) {
  return AI.processInput({ event: 'good_lunch', session });
}

module.exports = {
  run,
};
