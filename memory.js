const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('mem.db');

exports.getPhotoByTag = function(tag) {
	return new Promise((resolve, reject) => {
		let query = "SELECT * FROM photos WHERE 1=1 " + (tag ? " AND tags LIKE ? " : "") + " AND _ROWID_ >= (ABS(RANDOM()) % (SELECT MAX(_ROWID_) FROM photos))";
		let stmt = db.prepare(query);
		let photo = stmt.get(tag ? [ '%' + tag + '%' ] : [], function(err, photo) {
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
