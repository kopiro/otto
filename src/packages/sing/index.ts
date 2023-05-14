import Musixmatch from "musixmatch-node";
import config from "../../config";
import { getLanguageCodeFromLanguageName } from "../../helpers";
import { AIAction } from "../../types";

const mxm = new Musixmatch(config().musixmatch.apiKey);

const sing: AIAction = async ({ queryResult }) => {
  const { parameters: p } = queryResult;
  const [response, languageCode] = await Promise.all([
    mxm.getLyricsMatcher({
      q_track: p?.fields?.track?.stringValue,
      ...(p?.fields?.artist?.stringValue ? { q_artist: p?.fields?.artist.stringValue } : {}),
    }),
    getLanguageCodeFromLanguageName(p?.fields?.language?.stringValue),
  ]);
  const text = response.message.body.lyrics.lyrics_body.replace(/\*\*\*.+\*\*\*/g, "");
  return {
    text: text,
    options: {
      language: languageCode,
    },
  };
};

export default sing;
