#!/usr/bin/env node

require("../boot");

const TAG = "Say";

const TTS = requireInterface("tts");
const Play = apprequire("play");

async function sendMessage(text, language = "en") {
  const sentences = mimicHumanMessage(text);

  for (let sentence of sentences) {
    let polly_file = await TTS.getAudioFile(sentence, {
      language: language
    });
    await Play.playVoice(polly_file);
  }
}

if (process.argv[2] == null) {
  console.log('Usage: ./say.js "[TEXT]"');
  process.exit(1);
}

sendMessage(process.argv[2]);
