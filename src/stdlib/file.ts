import { baseDir } from "../paths";
import config from "../config";

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
}
