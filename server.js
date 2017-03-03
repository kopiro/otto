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
		tags: req.body.tags,
		url: req.body.url
	})
	.save()
	.then((memory) => {
		res.json({ memory: memory, message: 'Thank you' });
	})
	.catch((err) => {
		res.json({ error: err });
	});
});