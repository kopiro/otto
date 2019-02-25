#!/usr/bin/env node

require("../boot");

const TAG = "Say";

const TTS = requireInterface("tts");
const Play = requireLibrary("play");

async function sendMessage(text, language = "it") {
    let polly_file = await TTS.getAudioFile(text, {
      language: language
    });
    console.log(polly_file);
    await Play.playVoice(polly_file);
}

if (process.argv[2] == null) {
  console.log('Usage: ./say.js "[TEXT]"');
  process.exit(1);
}

sendMessage(process.argv[2]);
