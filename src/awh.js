const TAG = 'AWH';

const Router = apprequire('server').routerAwh;
 
Router.post('/', (req, res) => {
	if (req.body == null) {
		console.error(TAG, 'Empty body', req.body);
		return res.json({
			error: {
				message: 'Empty body'
			}
		});
	}

	const body = req.body;
	const result = req.body.result;
	const action = result.action;

	const resolve = (data) => {
		console.info(TAG, 'output', data);
		res.json(data);
	};

	const reject = (err) => {
		console.info(TAG, 'error', err);
		res.json({
			data: {
				error: err
			}
		});
	};

	console.debug(TAG, body);

	const sessionId = body.sessionId;

	new ORM.Session({ id: sessionId })
	.fetch({ withRelated: ['contact'] })
	.then((session_model) => {

		if (session_model == null) {
			console.error(TAG, `Creating a missing session ID with ${sessionId}`);
			session_model = new ORM.Session({ id: sessionId });
			session_model.save();
		}

		if (result.actionIncomplete !== true && !_.isEmpty(action)) {
			console.info(TAG, 'calling action', action);
			const action_fn = Actions.list[ action ]();
			return AI.fulfillmentPromiseTransformer(action_fn, body, session_model, resolve);
		}

		AI.fulfillmentTransformer(result.fulfillment, session_model, resolve);

	});
});

console.info(TAG, 'started');