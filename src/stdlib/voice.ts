import config from "../config";
import { getLocalObjectFromURI } from "../helpers";
import fs from "fs";
import * as Proc from "../lib/proc";
import { File } from "./file";

import { Signale } from "signale";

const TAG = "Voice";
const console = new Signale({
  scope: TAG,
});

type VoiceConfig = {
  addArgs: string[];
};

class Voice {
  constructor(private conf: VoiceConfig) {}

  /**
   * Play an item
   */
  async getFile(uri: string | Buffer): Promise<File> {
    const localUri = await getLocalObjectFromURI(uri, "mp3");

    const finalUri = new File(localUri.replace(/\.(.+)$/, "-remixed.$1"));
    if (fs.existsSync(finalUri.getAbsolutePath())) {
      return finalUri;
    }

    console.debug(`writing remixed file to ${finalUri.getAbsolutePath()}}`);
    await Proc.spawn("sox", [localUri, finalUri.getAbsolutePath()].concat(this.conf.addArgs)).result;
    return finalUri;
  }
}

let _instance: Voice;
export default (): Voice => {
  _instance = _instance || new Voice(config().voice);
  return _instance;
};
