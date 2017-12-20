#!/usr/bin/env node
require('../boot');

const TAG = 'Say';

const Polly = apprequire('polly');
const Play = apprequire('play');

async function sendMessage(text, language = 'it') {	
	const sentences = mimicHumanMessage(text);

	for (let sentence of sentences) {
		let polly_file = await Polly.getAudioFile(sentence, { language: language });
		await Play.voiceToSpeaker(polly_file);
	}
}

if (process.argv[2] == null) {
	console.log('Usage: ./say.js "[TEXT]"');
	process.exit(1);
}

sendMessage(process.argv[2]);