let knex = require('knex')({
  client: 'mysql',
  connection: config.mysql
});

let bookshelf = require('bookshelf')(knex);

exports.Contact = bookshelf.Model.extend({
	tableName: 'contacts',
	photos: function() {
		return this.hasMany(exports.ContactPhoto, 'contact_id');
	},
	getName: function() {
		return this.get('name');
	}
});

exports.ContactPhoto = bookshelf.Model.extend({
	tableName: 'contact_photos',
	contact: function() {
		return this.belongsTo(exports.Contact);
	}
});

exports.Memory = bookshelf.Model.extend({
	tableName: 'memories'
}, {

	byText: function(text) {
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
			query += "INNER JOIN memory_tags ON memory_tags.id_memory = memories.id ";
			query += "AND (" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
			query += "GROUP BY memories.id ORDER BY tags_matched DESC";

			DB.query(query, tags, (err, memories) => {
				if (err) return reject(err);
				if (memories.length == 0) return reject(err);

				// Since we ordered by tags_matched, the first one is the max
				let max_tags_matched = memories[0].tags_matched;
				memories = memories.filter((memory) => { 
					return memory.tags_matched == max_tags_matched;
				});
				let memory = memories[ _.random(0, memories.length - 1) ];

				resolve(new exports.Memory(memory));
			});
		});
	}

});

exports.MemoryTags = bookshelf.Model.extend({
	tablename: 'memory_tags'
});

/**
 * Spawn a server for memory data entry
 * Useful for Ciav.
 */
exports.spawnServerForDataEntry = function(port) {
	let API = require(__basedir + '/support/httpapi');

	API.get('/memories', (req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(fs.readFileSync(__basedir + '/html/dataentry.html'));
	});

	API.post('/memories', (req, res) => {
		if (_.isEmpty(req.body.title)) return res.json({ err: 'Title is missing' });
		if (_.isEmpty(req.body.text)) return res.json({ err: 'Text is missing' });
		if (_.isEmpty(req.body.tags)) return res.json({ err: 'Tags are missing' });

		new exports.Memory({
			title: req.body.title,
			text: req.body.text,
			date: req.body.date,
			url: req.body.url
		})
		.save()
		.then((memory) => {
			let tags = req.body.tags.split(',');
			tags.forEach(function(tag) {
				tag = tag.trim();
				if (!_.isEmpty(tag)) {
					new exports.model({
						tag: tag,
						id_memory: memory.id
					}).save();
				}
			});

			res.json({ message: 'Thank you' });
		})
		.catch((err) => {
			res.json({ err: err });
		});

	});
};