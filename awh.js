const TAG = 'AWH';
const router = require(__basedir + '/support/server').routerAwh;

router.post('/', (req, res) => {
	let result = req.body.result;
	if (result == null) {
		console.error(TAG, 'Empty body', req.body);
		return res.json({
			error: {
				message: 'Empty body'
			}
		});
	}

	let fulfillment = result.fulfillment;
	console.debug(TAG, JSON.stringify(result, null, 2));

	if (_.isEmpty(result.action)) {
		console.error(TAG, 'Empty action');
		return res.json({
			error: {
				message: 'Empty action'
			}
		});
	}

	if (result.actionIncomplete) {
		console.debug(TAG, 'action ${result.action} incomplete');
		return res.json({
			error: {
				message: 'Action incomplete'
			}
		});
	}

	if ( ! _.isFunction(Actions[result.action])) {
		console.error(TAG, `action ${result.action} not found`);
		return res.json({
			error: {
				message: 'Action not found'
			}
		});
	}

	Actions[result.action]()(result, {})
	.then((action_result) => {
		console.debug(TAG, `action result for ${result.action}`, action_result);
		res.json(action_result);
	})
	.catch((err) => {
		res.json({
			error: err
		});
	});
});

console.info(TAG, 'started');