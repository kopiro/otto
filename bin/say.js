#!/usr/bin/env node

require('../boot');

const TAG = 'Say';

const async = require('async');

const Polly = apprequire('polly');
const Play = apprequire('play');

function sendMessage(text, language) {
	return new Promise((resolve, reject) => {
		language = language || sessionModel.getTranslateTo();
		
		const sentences = mimicHumanMessage(text);
		sentences.forEach(async(sentence) => {
			let polly_file = await Polly.getAudioFile(sentence, { language: language });
			await Play.fileToSpeaker(polly_file);
		});

		emitter.emit('ai-spoken');

		resolve();
	});
}

if (process.argv[2] == null) {
	console.log('Usage: ./say.js "[TEXT]"');
	process.exit(1);
}

sendMessage(process.argv[2]);