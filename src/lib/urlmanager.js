const Proc = require('./proc');

async function open(url) {
  // TODO: handle errors
  // TODO: handle multiplatform
  return Proc.spawn('open', [url]);
}

module.exports = { open };
