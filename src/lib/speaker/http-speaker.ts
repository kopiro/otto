import { File } from "../../stdlib/file";
import { ISpeaker } from "../../stdlib/speaker";
import { getLocalObjectFromURI } from "../../helpers";
import config from "../../config";
import { Signale } from "signale";

const TAG = "Speaker.Http";
const logger = new Signale({
  scope: TAG,
});

export class HttpSpeaker implements ISpeaker {
  private readonly _config = config().httpSpeaker;

  async play(fileOrString: string | File) {
    const file = await getLocalObjectFromURI(fileOrString, "mp3");
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + this._config.token,
    };
    const body = JSON.stringify({
      url: file.getServerURL(),
    });
    logger.debug("HTTP Speaker body", body);
    const res = await fetch(this._config.url, {
      method: "POST",
      headers,
      body,
    });
    const json = await res.json();
    logger.debug("HTTP Speaker response", json);
    return;
  }

  kill() {
    // noop
  }
}
