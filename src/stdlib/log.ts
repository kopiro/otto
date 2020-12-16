import fs from "fs";
import { logDir } from "../paths";
import path from "path";

const TAG = "Log";

export class Log {
  tag: string;
  baseDir: string;

  constructor(tag: string) {
    this.tag = tag;
    this.baseDir = path.join(logDir, this.tag);
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir);
  }

  write(directory: string, identifier: string, what: any) {
    if (!process.env.DEBUG) return;

    const secondDir = path.join(this.baseDir, directory);
    if (!fs.existsSync(secondDir)) fs.mkdirSync(secondDir);

    fs.writeFile(path.join(secondDir, `${identifier}_${Date.now()}.json`), JSON.stringify(what, null, 2), (err) => {
      if (err) console.warn(TAG, err);
    });
  }
}
