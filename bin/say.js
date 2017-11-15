#!/usr/bin/env node

require('../boot');

const TAG = 'Say';

const async = require('async');

const Polly = apprequire('polly');
const Play = apprequire('play');

if (process.argv[2] == null) {
	console.log('Usage: ./say.js "[TEXT]"');
	process.exit(1);
}

let text = process.argv[2]; 
async.eachSeries(Util.mimicHumanMessage(text), (t, next) => { 
	Polly.getAudioFile(t).then((polly_file) => { 
		Play.fileToSpeaker(polly_file, (err) => { if 
			(err) return console.error(err); next();
		});
	});
}, () => {
	process.exit(0);
});
