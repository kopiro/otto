let Server = apprequire('server');

///////////
// Admin //
///////////

Server.routerAdmin.get('/', (req, res) => {
	res.render('admin/home');
});

Server.routerAdmin.get('/cron', (req, res) => {
	res.render('admin/cron');
});

Server.routerAdmin.get('/memories', (req, res) => {
	res.render('admin/memories/list');
});

Server.routerAdmin.get('/memories/:id', (req, res) => {
	new ORM.Memory({ id: req.params.id })
	.fetch({ require: true })
	.then((data) => {
		res.render('admin/memories/edit', {
			model: data.toJSON()
		});
	})
	.catch((err) => res.json({ error: err }));
});

/////////
// API //
/////////

Server.routerApi.get('/cron', (req, res) => {
	new ORM.Cron()
	.fetchAll()
	.then((data) => res.json({ data }))
	.catch((err) => res.json({ error: err }));
});

Server.routerApi.post('/cron', (req, res) => {
	const attrs = [ 'iso_weekday', 'hours', 'minutes', 'text' ];

	for (var k in attrs) {
		if (_.isEmpty(req.body[attrs[k]])) {
			return res.json({ error: attrs[k] + ' is missing' });
		}
	}

	new ORM.Cron(
	_.pick(req.body, attrs)
	)
	.save()
	.then((data) => res.json({ data }))
	.catch((err) => res.json({ error: err }));
});

Server.routerApi.get('/memories', (req, res) => {
	new ORM.Memory()
	.fetchAll()
	.then((data) => res.json({ data }))
	.catch((err) => res.json({ error: err }));
});

Server.routerApi.get('/memories/:id', (req, res) => {
	new ORM.Memory({ id: req.params.id })
	.fetchAll()
	.then((data) => res.json(data))
	.catch((err) => res.json({ error: err }));
});

Server.routerApi.post('/memories/:id', (req, res) => {
	const attrs = [ 'title', 'text', 'tags' ];

	for (var k in attrs) {
		if (attrs.hasOwnProperty(k)) {
			if (_.isEmpty(req.body[attrs[k]])) {
				return res.json({ error: attrs[k] + ' is missing' });
			}
		}
	}

	new ORM.Memory({ id: req.params.id })
	.set(_.pick(req.body, attrs))
	.save()
	.then((data) => res.json({ data }))
	.catch((err) => res.json({ error: err }));
});

Server.routerApi.post('/memories', (req, res) => {
	const attrs = [ 'title', 'text', 'tags' ];

	for (var k in attrs) {
		if (attrs.hasOwnProperty(k)) {
			if (_.isEmpty(req.body[attrs[k]])) {
				return res.json({ error: attrs[k] + ' is missing' });
			}
		}
	}

	new ORM.Memory(
	_.pick(req.body, attrs)
	)
	.save()
	.then((data) => res.json({ data }))
	.catch((err) => res.json({ error: err }));
});