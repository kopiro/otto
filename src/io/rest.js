const TAG = 'IO.Rest';
exports.config = {
	id: 'rest',
	onlyServerMode: true
};

const _config = config.rest;

const emitter = exports.emitter = new(require('events').EventEmitter)();

const Server = apprequire('server');

/**
 * True when startInput has been called
 */
let started = false;

async function processInput(req, res) {
	if (req.query.sessionId == null) {
		throw new Error('Invalid session identifier');
	}

	if (req.query.text == null) {
		throw new Error('Provide a text');
	}

	// Register the session
	const session = await IOManager.registerSession({
		sessionId: req.query.sessionId,
		io_driver: 'rest',
		io_data: req.query,
		text: req.query.text
	});

	session.res = res;

	emitter.emit('input', {
		session: session,
		params: {
			text: req.query.text
		}
	});
}

/**
 * Start the polling/webhook cycle
 */
exports.startInput = function () {
	if (started) return;
	started = true;

	Server.routerIO.use('/rest', require('body-parser').json(), async (req, res) => {
		try {
			await processInput(req, res);
		} catch (err) {
			res.json({
				error: {
					message: err.message,
					code: err.code
				}
			});
		}
	});
	console.info(TAG, 'started');
};

/**
 * Output an object to the user
 * @param {Object} f	The item 
 * @param {*} session The user session
 */
exports.output = async function (f, session) {
	console.info(TAG, 'output');
	console.dir({
		f,
		session
	}, {
		depth: 2
	});

	// Inform observers
	emitter.emit('output', {
		session: session,
		fulfillment: f
	});

	return session.res.json(f);
};