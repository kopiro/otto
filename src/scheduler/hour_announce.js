const AI = require('../stdlib/ai');
const Moment = require('../lib/moment');

function run({ session }) {
  const now = Moment();
  if (now.hours() >= 10 && now.hours() <= 23) {
    return AI.processInput({ params: { event: 'hour_announce' }, session });
  }
  return null;
}

module.exports = {
  run
};
