import config from "../config";
import { getLocalObjectFromURI } from "../helpers";
import { BufferWithExtension } from "../types";
import fs from "fs";
import * as Proc from "../lib/proc";
import { baseDir } from "../paths";
import { File } from "./file";

const TAG = "Voice";

type VoiceConfig = {
  addArgs: string[];
};

class Voice {
  config: VoiceConfig;

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  /**
   * Play an item
   */
  async getFile(uri: string | Buffer | BufferWithExtension): Promise<File> {
    const localUri = await getLocalObjectFromURI(uri);

    const finalUri = new File(localUri.replace(/\.(.+)$/, "-remixed.$1"));
    if (fs.existsSync(finalUri.getAbsoluteFSPath())) {
      return finalUri;
    }

    console.debug(TAG, `writing remixed file to ${finalUri.getAbsoluteFSPath()}}`);
    await Proc.spawn("sox", [localUri, finalUri.getAbsoluteFSPath()].concat(this.config.addArgs));
    return finalUri;
  }
}

export default new Voice(config().voice);
