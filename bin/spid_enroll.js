#!/usr/bin/env node
require('../boot');

const Cognitive = apprequire('cognitive');
const Rec = apprequire('rec');

const rec_stream = Rec.start({
	time: 10
});

const tmp_file = __tmpdir + '/spid_' + require('uuid').v4() + '.wav';
rec_stream.pipe(fs.createWriteStream(tmp_file));
rec_stream.on('end', () => {
	console.log('Processing', tmp_file);

	const tmp_file_stream = fs.createReadStream(tmp_file);

	Cognitive.spid.createProfile('en-US', (err, {identificationProfileId}) => {
		if (err) return console.error('Error', err);

		console.log('IPI: ' + identificationProfileId);
		Cognitive.spid.createEnrollment(identificationProfileId, tmp_file_stream, (err, body) => {
			if (err) return console.error('Error', err);

			console.log(err, body);
		});
	});

});

console.log('Speak for 10 seconds...');