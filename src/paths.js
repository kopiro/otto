const fs = require("fs");

const baseDir = fs.realpathSync(`${__dirname}/..`);
const tmpDir = `${baseDir}/tmp`;
const cacheDir = `${baseDir}/cache`;
const etcDir = `${baseDir}/etc`;
const keysDir = `${baseDir}/keys`;
const storageDir = `${baseDir}/storage`;

module.exports = {
  baseDir,
  tmpDir,
  cacheDir,
  etcDir,
  keysDir,
  storageDir
};
