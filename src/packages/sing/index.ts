import Musixmatch from "musixmatch-node";
import config from "../../config";
import { getLanguageCodeFromLanguageLongString } from "../../helpers";
import { Fulfillment } from "../../types";

const mxm = new Musixmatch(config().musixmatch.apiKey);

export default async function ({ queryResult }): Promise<Fulfillment> {
  const { parameters } = queryResult;
  const { track, artist, language } = parameters;
  const [response, languageCode] = await Promise.all([
    mxm.getLyricsMatcher({
      q_track: track,
      ...(artist ? { q_artist: artist } : {}),
    }),
    getLanguageCodeFromLanguageLongString(language),
  ]);
  const text = response.message.body.lyrics.lyrics_body.replace(/\*\*\*.+\*\*\*/g, "");
  return {
    text: text,
    payload: {
      language: languageCode,
    },
  };
}
