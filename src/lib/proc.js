const TAG = 'Proc';
const { spawn: systemSpawn } = require('child_process');

function spawn(program, args) {
  return new Promise((resolve, reject) => {
    console.log(TAG, program, args.join(' '));

    const spawned = systemSpawn(program, args);

    let stdout = '';
    let stderr = '';

    spawned.stdout.on('data', (buf) => {
      stdout += buf;
    });

    spawned.stderr.on('data', (buf) => {
      stderr += buf;
    });

    spawned.on('close', (err) => {
      if (err) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

module.exports = { spawn };
