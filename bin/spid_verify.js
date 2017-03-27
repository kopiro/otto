#!/usr/bin/env node
require('../boot');

const Cognitive = apprequire('cognitive');
const Rec = apprequire('rec');

const rec_stream = Rec.start({
	silence: true
});

Cognitive.spid.verify(config.spid[0], rec_stream); 

console.log('Speak...');