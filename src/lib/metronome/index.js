const TAG = 'Metronome';

const Play = apprequire('play');

const path = require('path')
const high = path.join(__dirname, './sound/HighSeiko.wav');
const low = path.join(__dirname, './sound/LowSeiko.wav');

let intv = null;

exports.start = function(bpm = 120, steps = 4) {
    var delay = (60 * 1000) / bpm;
    var count = steps - 1;
    intv = setInterval(() => {
        if (++count == steps){
            Play.fileToSpeaker(high);
            count = 0;
        } else {
            Play.fileToSpeaker(low);
        }
    }, delay);
    return intv;
};

exports.stop = function() {
    clearInterval(intv);
};