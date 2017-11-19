const TAG = 'AWH';

const _ = require('underscore');

const Router = apprequire('server').routerAwh;

Router.get('/', (req, res) => {
	res.json({ error: { message: 'You should call in POST' } });
});
 
Router.post('/', (req, res) => {
	if (req.body == null) {
		console.error(TAG, 'empty body');
		return res.json({ error: { message: 'Empty body' } });
	}

	console.info(TAG, 'request', JSON.stringify(req.body, null, 2));

	const body = req.body;
	const result = req.body.result;
	const action = result.action;
	const sessionId = body.sessionId;

	Data.Session
	.findOne({ _id: sessionId })
	.then(async(session_model) => {

		if (session_model == null) {
			console.error(TAG, `creating a missing session ID with ${sessionId}`);
			session_model = new Data.Session({ _id: sessionId });
			session_model.save();
		}

		try {

			let fulfillment;

			if (result.actionIncomplete !== true && !_.isEmpty(action)) {
				const action_fn = Actions.list[ action ];
				console.info(TAG, 'calling awh action', action);
				fulfillment = await AI.fulfillmentPromiseTransformer(action_fn(), body, session_model);
			} else {
				fulfillment = await AI.fulfillmentTransformer(result.fulfillment, session_model);
			}

			console.info(TAG, 'response', fulfillment);

			res.json(fulfillment);

		} catch (ex) {
			console.info(TAG, 'error', ex);
			res.json({ data: { error: ex } });
		}
	});
});

console.info(TAG, 'started');