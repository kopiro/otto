import { baseDir } from "../paths";
import config from "../config";

export class File {
  absoluteFSPath: string;

  constructor(absoluteFSPath: string) {
    this.absoluteFSPath = absoluteFSPath;
  }

  getAbsoluteFSPath() {
    return this.absoluteFSPath;
  }

  getRelativePath() {
    return this.absoluteFSPath.replace(baseDir, "");
  }

  getURI(protocol: string = config().server.protocol) {
    return [protocol, "://", config().server.domain, this.getRelativePath()].join("");
  }
}
