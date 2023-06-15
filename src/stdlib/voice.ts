import config from "../config";
import { getLocalObjectFromURI } from "../helpers";
import fs from "fs";
import * as Proc from "./proc";
import { File } from "./file";

import { Signale } from "signale";
import { Fulfillment } from "../types";
import { TextToSpeech } from "./text-to-speech";
import { TSession } from "../data/session";

const TAG = "Voice";
const logger = new Signale({
  scope: TAG,
});

export async function getVoiceFileFromMixedContent(mixedContent: string | File): Promise<File> {
  const conf = config().voice;
  const file = await getLocalObjectFromURI(mixedContent, "mp3");

  const remixedPath = file.getAbsolutePath().replace(/\.(.+)$/, "-remixed.$1");
  const finalUri = new File(remixedPath);
  if (fs.existsSync(finalUri.getAbsolutePath())) {
    logger.debug(`Reusing existing file ${finalUri.getAbsolutePath()}}`);
    return finalUri;
  }

  logger.debug(`Writing remixed file to ${finalUri.getAbsolutePath()}}`);
  await Proc.processSpawn("sox", [file.getAbsolutePath(), finalUri.getAbsolutePath()].concat(conf.addArgs)).result;

  return finalUri;
}

export async function getVoiceFileFromFulfillment(fulfillment: Fulfillment, session: TSession): Promise<File> {
  const audioFile = await TextToSpeech.getInstance().getAudioFile(
    fulfillment.text || "",
    fulfillment.options?.language || session.getLanguage() || config().language,
  );
  return getVoiceFileFromMixedContent(audioFile);
}
