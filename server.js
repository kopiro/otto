let API = require(__basedir + '/support/httpapi');

API.get('/dataentry/memories', (req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(fs.readFileSync(__basedir + '/html/memories.html'));
});

API.post('/memories', (req, res) => {
	if (_.isEmpty(req.body.title)) return res.json({ error: 'Title is missing' });
	if (_.isEmpty(req.body.text)) return res.json({ error: 'Text is missing' });
	if (_.isEmpty(req.body.tags)) return res.json({ error: 'Tags are missing' });

	new exports.Memory({
		title: req.body.title,
		text: req.body.text,
		date: req.body.date,
		url: req.body.url
	})
	.save()
	.then((memory) => {
		if (req.body.tags) {
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
		}

		res.json({ message: 'Thank you' });
	})
	.catch((err) => {
		res.json({ error: err });
	});
});