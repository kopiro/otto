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
		query += "INNER JOIN tags ON tags.id_memory = memories.id AND (" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
		query += "GROUP BY memories.id ORDER BY tags_matched DESC";

		DB.query(query, tags, (err, memories) => {
			if (err || memories.length === 0) {
				reject({
					err: err,
					notFound: true
				});
				return;
			}

			let max_tags_matched = memories[0].tags_matched;
			memories = memories.filter((memory) => { 
				return memory.tags_matched == max_tags_matched;
			});
			let memory = memories[_.random(0, memories.length-1)];

			console.debug('Memory.getMemoryByText', memory);

			resolve(memory);
		});
	});
};

exports.spawnServerForDataEntry = function() {
	let http = require('http');
	let fs = require('fs');

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
					DB.query('INSERT INTO tags SET ?', {
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

exports.spawnServerForDataEntry();