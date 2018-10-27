const fs = require('fs');

// Imports the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech');

// Creates a client
const client = new textToSpeech.TextToSpeechClient({
	options: {
		keyFilename: '../keys/gcloud.json'
	}
});

// The text to synthesize
const text = 'Risposta sbagliata! ti metto un po\' di musica per svegliarti allora... ma prima ti ripeto la domanda, quanto fa nove per nove?';

// Construct the request
const request = {
	input: {
		text: text
	},
	// Select the language and SSML Voice Gender (optional)
	voice: {
		languageCode: 'it-IT',
		name: 'it-IT-Wavenet-A',
		ssmlGender: 'FEMALE'
	},
	// Select the type of audio encoding
	audioConfig: {
		audioEncoding: 'MP3'
	},
};

// Performs the Text-to-Speech request
client.synthesizeSpeech(request, (err, response) => {
	if (err) {
		console.error('ERROR:', err);
		return;
	}

	// Write the binary audio content to a local file
	fs.writeFile('output.mp3', response.audioContent, 'binary', err => {
		if (err) {
			console.error('ERROR:', err);
			return;
		}
		console.log('Audio content written to file: output.mp3');
	});
});