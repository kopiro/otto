const TAG = 'Proc';
const spawn = require('child_process').spawn;

exports.spawn = function(program, args) {
   return new Promise((resolve, reject) => {
      const spawned = spawn(program, args);

      let stdout = '';
      let stderr = '';

      spawned.stdout.on('data', (buf) => { stdout += buf; });
      spawned.stderr.on('data', (buf) => { stderr += buf; });

      spawned.on('close', (err) => {
            if (err) return reject(stderr);
            resolve(stdout);
      });
   });
};
