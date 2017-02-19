const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('mem.db');

const random_memory_query = " AND _ROWID_ >= (ABS(RANDOM()) % (SELECT MAX(_ROWID_) FROM memories)) LIMIT 1";

exports.getMemoryByText = function(text) {
	return new Promise((resolve, reject) => {

		// Prepare tags
		let tags = [];
		text = text.replace(/[^a-zA-Z ]+/g, '');
		text.split(' ').forEach(function(tag) {
			if (tag.substr(0,1) === tag.substr(0,1).toUpperCase() || tag.length >= 4) {
				tags.push(tag.toLowerCase());
			}
		});

		let query = "SELECT *, COUNT(tag) as nof_tags FROM memories ";
		query += "JOIN tags ON tags.id_memory = memories.id WHERE ";
		query += "(" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
		query += "GROUP BY memories.id ORDER BY nof_tags DESC LIMIT 1";

		console.log(query);

		let stmt = db.prepare(query);
		stmt.get(tags, (err, memory) => {
			console.debug('Memory.getMemoryByText', memory);

			if (memory == null) {
				reject({
					notFound: true
				});
				return;
			}

			resolve(memory);
		});
	});
};
