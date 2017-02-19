const db = require('mysql').createConnection(config.mysql);

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
		query += "LEFT JOIN tags ON tags.id_memory = memories.id AND (" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
		query += "GROUP BY memories.id ORDER BY tags_matched DESC";

		db.query(query, tags, (error, memories) => {
			if (error || memories.length === 0) {
				reject({
					error: error,
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

	app.post('/', (req, res) => {
		if (null == req.body.title) return res.end('Title is missing');
		if (null == req.body.text) return res.end('Text is missing');
		
		db.query('INSERT INTO memories SET ?', {
			title: req.body.title,
			text: req.body.text,
			date: req.body.date,
			url: req.body.url
		}, function (error, results, fields) {
			if (error) throw error;
			let id = results.insertId;
			let tags = req.body.tags.split(',');
			tags.forEach(function(tag) {
				tag = tag.trim();
				if (tag.length != 0) {
					db.query('INSERT INTO tags SET ?', {
						tag: tag,
						id_memory: id
					});
				}
			});

			res.end(fs.readFileSync('./dataentry.html'));
		});

	});
	
	app.listen(8880, () => {
		console.info('Server for data-entry is started on port 8880');
	});
};


exports.spawnServerForDataEntry();