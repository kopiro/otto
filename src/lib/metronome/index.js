const TAG = 'Metronome';

const Play = requireLibrary('play');

const path = require('path');

const high = path.join(__dirname, './sound/HighSeiko.wav');
const low = path.join(__dirname, './sound/LowSeiko.wav');

let intv = null;

exports.start = function (bpm = 120, steps = 4) {
  const delay = (60 * 1000) / bpm;
  let count = steps - 1;
  intv = setInterval(() => {
    if (++count == steps) {
      Play.playURI(high);
      count = 0;
    } else {
      Play.playURI(low);
    }
  }, delay);
  return intv;
};

exports.stop = function () {
  clearInterval(intv);
};
