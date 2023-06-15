import { baseDir, tmpDir } from "../paths";
import config from "../config";
import { v4 as uuid } from "uuid";
import path from "path";

export class File {
  private absolutePath: string;

  constructor(absolutePath: string) {
    this.absolutePath = absolutePath;
  }

  getAbsolutePath() {
    return this.absolutePath;
  }

  getRelativePath() {
    return this.absolutePath.replace(baseDir, "");
  }

  getURI(protocol: string = config().server.protocol) {
    return [protocol, "://", config().server.domain, this.getRelativePath()].join("");
  }

  static getTmpFile(extension: string) {
    const name = path.join(tmpDir, `${uuid()}.${extension}`);
    return new File(name);
  }
}
