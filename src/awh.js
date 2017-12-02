const TAG = 'AWH';

const _ = require('underscore');

const Router = apprequire('server').routerAwh;

Router.get('/', (req, res) => {
	res.json({ error: { message: 'You should call in POST' } });
});
 
Router.post('/', async(req, res) => {
	if (req.body == null) {
		console.error(TAG, 'empty body');
		return res.json({ error: { message: 'Empty body' } });
	}

	console.info(TAG, 'request');
	console.dir(req.body);

	const body = req.body;
	const sessionId = body.sessionId;

	let session_model = await Data.Session.findOne({ _id: sessionId });

	if (session_model == null) {
		console.error(TAG, `creating a missing session ID with ${sessionId}`);
		session_model = new Data.Session({ _id: sessionId });
		session_model.save();
	}

	try {
		let fulfillment = AI.apiaiResultParser(body, session_model);
		console.info(TAG, 'fulfillment');
		console.dir(fulfillment, { depth: 10 });
		res.json(fulfillment);
	} catch (ex) {
		console.info(TAG, 'error', ex);
		res.json({ data: { error: ex } });
	}
});

console.info(TAG, 'started');