const Musixmatch = require("musixmatch-node");
const config = require("../../config");
const { getLanguageCodeFromLanguageLongString } = require("../../helpers");

const mxm = new Musixmatch(config.musixmatch.apiKey);

module.exports = async ({ queryResult }) => {
  const { parameters } = queryResult;
  const { track, artist, language } = parameters;
  const [response, languageCode] = await Promise.all([
    mxm.getLyricsMatcher({
      q_track: track,
      ...(artist ? { q_artist: artist } : {})
    }),
    getLanguageCodeFromLanguageLongString(language)
  ]);
  const text = response.message.body.lyrics.lyrics_body.replace(
    /\*\*\*.+\*\*\*/g,
    ""
  );
  return {
    fulfillmentText: text,
    payload: {
      language: languageCode
    }
  };
};
