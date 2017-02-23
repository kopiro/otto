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
		return (this.get('first_name') + ' ' + this.get('last_name'));
	}
});

exports.ContactPhoto = bookshelf.Model.extend({
	tableName: 'contact_photos',
	contact: function() {
		return this.belongsTo(exports.Contact);
	}
});

// TODO: move to Model
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
		query += "INNER JOIN memory_tags ON memory_tags.id_memory = memories.id AND (" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
		query += "GROUP BY memories.id ORDER BY tags_matched DESC";

		DB.query(query, tags, (err, memories) => {
			if (err || memories.length === 0) {
				return reject({
					err: err,
				});
			}

			let max_tags_matched = memories[0].tags_matched;
			memories = memories.filter((memory) => { 
				return memory.tags_matched == max_tags_matched;
			});
			let memory = memories[_.random(0, memories.length-1)];

			resolve(memory);
		});
	});
};

exports.spawnServerForDataEntry = function() {
	let http = require('http');

	let express = require('express');
	let app = express();

	app.use(require('body-parser').urlencoded({
		extended: true
	}));

	app.get('/', (req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(fs.readFileSync('./dataentry.html'));
	});

	app.post('/send', (req, res) => {
		if (_.isEmpty(req.body.title)) return res.json({ err: 'Title is missing' });
		if (_.isEmpty(req.body.text)) return res.json({ err: 'Text is missing' });
		if (_.isEmpty(req.body.tags)) return res.json({ err: 'Tags are missing' });

		DB.query('INSERT INTO memories SET ?', {
			title: req.body.title,
			text: req.body.text,
			date: req.body.date,
			url: req.body.url
		}, function (err, results, fields) {
			if (err) throw err;
			let id = results.insertId;
			let tags = req.body.tags.split(',');
			tags.forEach(function(tag) {
				tag = tag.trim();
				if (!_.isEmpty(tag)) {
					DB.query('INSERT INTO memory_tags SET ?', {
						tag: tag,
						id_memory: id
					});
				}
			});

			res.json({ message: 'Thank you' });
		});

	});
	
	app.listen(8880, () => {
		console.info('Server for data-entry is started on port 8880');
	});
};