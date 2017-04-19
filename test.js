apprequire('camera').takePhoto()
.then((file) => {
	const read_stream = fs.createReadStream(file);
	const to = 'webcam/' + uuid() + '.jpg';
	const write_stream = apprequire('gcs').file(to).createWriteStream();
	console.log(to);
	
	read_stream.pipe(write_stream)
	.on('error', function(err) {
		console.error(err);
	})
	.on('finish', function() {
	});
});

// function outCognitive(data, image, io) {
// 	return new Promise((resolve, reject) => {
// 		Cognitive.face.detect(image.remoteFile, (err, resp) => {
// 			if (err) return reject(err);
// 			if (resp.length === 0) return reject();

// 			Cognitive.face.identify([ resp[0].faceId ], (err, resp) => {
// 				if (resp.length === 0 || resp[0] == null || resp[0].candidates.length === 0) return reject(err);
// 				let person_id = resp[0].candidates[0].personId;

// 				new ORM.Contact
// 				.where({ person_id: person_id })
// 				.fetch({ required: true })
// 				.then((contact) => {

// 					const name = contact.get('first_name');
// 					const responses = [
// 					`Hey, ciao ${name}!`,
// 					`Ma... è ${name}`,
// 					`Da quanto tempo ${name}!, come stai??`
// 					];

// 					resolve({ 
// 						text: responses.getRandom() 
// 					});
// 				})
// 				.catch(reject);
// 			}); 

// 		});
// 	});
// }