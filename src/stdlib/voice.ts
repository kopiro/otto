import config from "../config";
import { getLocalObjectFromURI } from "../helpers";
import { BufferWithExtension } from "../types";
import fs from "fs";
import * as Proc from "../lib/proc";
import { baseDir } from "../paths";

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
  async getFile(uri: string | Buffer | BufferWithExtension): Promise<string> {
    const localUri = await getLocalObjectFromURI(uri);

    const finalUri = localUri.replace(/\.(.+)$/, "-remixed.$1");
    if (fs.existsSync(finalUri)) {
      return finalUri;
    }

    console.debug(TAG, `writing remixed file to ${finalUri}`);
    await Proc.spawn("sox", [localUri, finalUri].concat(this.config.addArgs));
    return finalUri;
  }

  async getRelativeURI(uri: string | Buffer | BufferWithExtension): Promise<string> {
    const file = await this.getFile(uri);
    return file.replace(baseDir, "");
  }

  async getAbsoluteURI(uri: string | Buffer | BufferWithExtension): Promise<string> {
    return [config().server.domain, await this.getRelativeURI(uri)].join("");
  }
}

export default new Voice(config().voice);
