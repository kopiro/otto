#!/usr/bin/env node
require('../boot');

const TAG = 'Say';
const Polly = apprequire('polly');

if (process.argv[2] == null) {
	console.log('Usage: ./say.js "[TEXT]"');
	process.exit(1);
}

Polly.play(process.argv[2]);