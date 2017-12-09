#!/usr/bin/env node

require('../boot');

const TAG = 'Say';

const async = require('async');

const Polly = apprequire('polly');
const Play = apprequire('play');

async function sendMessage(text, language = 'it') {
	const key = md5(text);
	currentSendMessageKey = key;
	
	const sentences = mimicHumanMessage(text);

	for (let sentence of sentences) {
		if (currentSendMessageKey === key) {
			let polly_file = await Polly.getAudioFile(sentence, { language: language });
			await Play.fileToSpeaker(polly_file);
		}
	}

	return true;
}

if (process.argv[2] == null) {
	console.log('Usage: ./say.js "[TEXT]"');
	process.exit(1);
}

sendMessage(process.argv[2]);