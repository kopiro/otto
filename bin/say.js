require("../src/boot");
const { argv } = require("yargs");
const config = require("../src/config");
const TTS = require("../src/interfaces/tts");
const Play = require("../src/lib/play");

(async function main(text = "", language = config.language) {
  const audioFile = await TTS.getAudioFile(text, { language });
  await Play.playVoice(audioFile);
})(argv.text, argv.language);
