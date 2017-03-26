const TAG = 'AWH';
const router = require(__basedir + '/support/server').routerAwh;
const actions = require(__basedir + '/actions');

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

	if ( ! _.isFunction(actions[action])) {
		console.error(TAG, `action ${action} not found`);
		return res.json({
			error: {
				message: 'Action not found'
			}
		});
	}

	actions[action]()(req.body, {})
	.then((action_result) => {
		console.debug(TAG, 'action_result', action_result);
		res.json(action_result);
	})
	.catch((action_err) => {
		console.error(TAG, 'action_err', action_err);
		res.json({
			error: action_err
		});
	});
});

console.info(TAG, 'started');