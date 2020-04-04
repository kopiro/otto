import fs from "fs";

export const baseDir = fs.realpathSync(`${__dirname}/..`);
export const tmpDir = `${baseDir}/tmp`;
export const cacheDir = `${baseDir}/cache`;
export const etcDir = `${baseDir}/etc`;
export const keysDir = `${baseDir}/keys`;
export const storageDir = `${baseDir}/storage`;
