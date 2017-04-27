require('../boot');

const TAG = 'FaceScheduler';

const Cognitive = apprequire('cognitive');

Cognitive.face.createPersonGroup((err, resp) => {
	Memory.Contact
	.where({ 
		approved: 1 
	})
	.fetchAll({
		withRelated: ['photos']
	})
	.then((contacts) => {

		async.eachSeries(contacts.toArray(), (contact, callback) => {

			let createPerson = () => {
				return new Promise((resolve, reject) => {
					if (contact.get('person_id')) return resolve();

					Cognitive.face.createPerson(contact.id, (err, resp) => {
						if (err) return reject(err);

						console.info(TAG, 'Created person ID', resp);
						contact.set('person_id', resp.personId);
						contact.save();
						resolve();
					});
				});
			};

			let addPersonFace = (photo) => {
				return new Promise((resolve, reject) => {
					if (photo.get('face_id')) return resolve();

					Cognitive.face.addPersonFace(contact.get('person_id'), photo.get('url'), (err, resp) => {
						if (err) return reject(err);

						console.info(TAG, 'Created face ID', resp);
						if (resp.persistedFaceId) {
							photo.set('face_id', resp.persistedFaceId);
							photo.save();
						}
						resolve();
					});
				});
			};

			let addPersonFaces = () => {
				return new Promise((resolve, reject) => {
					async.each(contact.related('photos').toArray(), (photo, callback) => {
						addPersonFace(photo)
						.then(callback)
						.catch(callback);
					}, resolve);
				});
			};

			createPerson()
			.then(addPersonFaces)
			.then(callback)
			.catch(callback);

		}, () => {

			Cognitive.face.trainPersonGroup(() => {
				console.info(TAG, 'Training started');
				process.exit();
			});

		});
	});

});
