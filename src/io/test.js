const TAG = 'IO.Test';
exports.config = {
  id: 'test',
};

const _ = require('underscore');
const fs = require('fs');
const readline = require('readline');

const emitter = (exports.emitter = new (require('events')).EventEmitter());

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let initial_strings = [];
try {
  initial_strings = fs
    .readFileSync(`${__etcdir}/io_test.txt`)
    .toString()
    .split('\n');
} catch (err) {}

async function registerGlobalSession() {
  return IOManager.registerSession({
    sessionId: null,
    io_driver: 'test',
  });
}

exports.startInput = async function () {
  // Ensure session is present
  await registerGlobalSession();

  const msg = initial_strings.shift();

  if (!_.isEmpty(msg)) {
    for (let i = 0; i < 50; i++) process.stdout.write('+');
    process.stdout.write('\n');
    process.stdout.write(msg);
    process.stdout.write('\n');
    for (let i = 0; i < 50; i++) process.stdout.write('+');
    process.stdout.write('\n');
    return emitter.emit('input', {
      session: IOManager.session,
      params: {
        text: msg,
      },
    });
  }

  rl.question('> ', (answer) => {
    emitter.emit('input', {
      session: IOManager.session,
      params: {
        text: answer,
      },
    });
  });
};

exports.output = async function (f) {
  console.info(TAG, 'output');
  emitter.emit('output', {
    session: IOManager.session,
    fulfillment: f,
  });

  for (let i = 0; i < 50; i++) process.stdout.write('+');
  process.stdout.write('\n');
  console.dir(f, {
    depth: null,
  });
  for (let i = 0; i < 50; i++) process.stdout.write('+');
  process.stdout.write('\n');

  setTimeout(() => {
    exports.startInput();
  }, 1000);
};
