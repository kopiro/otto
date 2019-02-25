const TAG = 'Leds';

exports.id = 'leds';

const RaspiLeds = requireLibrary('raspi/leds');

const colorForRecognizing = [0, 255, 0];
const colorForOutput = [255, 0, 0];
const colorForThinking = [255, 255, 0];

exports.canHandleOutput = function (e) {
  return false;
};

exports.attach = function (io) {
  RaspiLeds.off();

  io.emitter.on('input', () => {
    RaspiLeds.setColor(colorForThinking);
  });

  io.emitter.on('output', () => {
    RaspiLeds.setColor(colorForOutput);
  });

  io.emitter.on('thinking', () => {
    RaspiLeds.setColor(colorForThinking);
  });

  io.emitter.on('recognizing', () => {
    RaspiLeds.setColor(colorForRecognizing);
  });

  io.emitter.on('notrecognizing', () => {
    RaspiLeds.off();
  });

  io.emitter.on('stopped', () => {
    RaspiLeds.off();
  });
};
