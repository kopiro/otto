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

		let query = "SELECT *, COUNT(tag) as tags_matched FROM memories ";
		query += "LEFT JOIN tags ON tags.id_memory = memories.id AND ";
		query += "(" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
		query += "GROUP BY memories.id ORDER BY tags_matched DESC";

		console.log(query);

		let stmt = db.prepare(query);
		stmt.all(tags, (err, memories) => {
			if (memories.length === 0) {
				reject({
					notFound: true
				});
				return;
			}

			let max_tags_matched = memories[0].tags_matched;
			memories = memories.filter((memory) => { 
				return memory.tags_matched == max_tags_matched;
			});
			let memory = memories[_.random(0, memories.length)];

			console.debug('Memory.getMemoryByText', memory);

			resolve(memory);
		});
	});
};
