const TAG = 'AWH';
const router = require(__basedir + '/support/server').routerAwh;

const Actions = require(__basedir + '/actions');
 
router.post('/', (req, res) => {
	if (req.body == null) {
		console.error(TAG, 'Empty body', req.body);
		return res.json({
			error: {
				message: 'Empty body'
			}
		});
	}

	console.debug(TAG, req.body);
	const action = req.body.result.action;

	if (_.isEmpty(action)) {
		console.error(TAG, 'Empty action');
		return res.json({
			error: {
				message: 'Empty action'
			}
		});
	}

	if (req.body.result.actionIncomplete) {
		console.debug(TAG, 'action ${action} incomplete');
		return res.json({
			error: {
				message: 'Action incomplete'
			}
		});
	}

	const action_fn_promise = Actions.list[ action ];

	if (!_.isFunction(action_fn_promise)) {
		console.error(TAG, `action ${action} not found`);
		return res.json({
			error: {
				message: 'Action not found'
			}
		});
	}

	new Memory.Session({ id: req.body.sessionId })
	.fetch()
	.then((session_model) => {

		if (session_model == null) {
			console.error(TAG, `Creating a model (fpt) with ${sessionId}`);
			session_model = new Memory.Session({ id: sessionId });
			session_model.save();
		}

		AI.fulfillmentPromiseTransformer( action_fn_promise(), req.body, session_model )
		.then((fullfilment) => {
			console.debug(TAG, 'fullfilment', fullfilment);
			res.json(fullfilment);
		})
		.catch((err) => {
			console.error(TAG, 'error', err);
			res.json({ error: err });
		});

	});
});

console.info(TAG, 'started');