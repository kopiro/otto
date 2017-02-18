const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('mem.db');

exports.getPhotoByTag = function(tag) {
	return new Promise((resolve, reject) => {
		let stmt = db.prepare("SELECT * FROM photos WHERE tags LIKE ?");
		let photo = stmt.get([ '%' + tag + '%' ], function(err, photo) {
			console.debug('Memory.getPhotoByTag', photo);

			if (photo == null) {
				reject();
				return;
			}

			resolve({
				url: photo.url
			});
		});
	});
};
