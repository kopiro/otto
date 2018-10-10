const TAG = 'IO.Rest';
exports.config = {
	id: 'rest'
};

const _config = config.rest;

const emitter = exports.emitter = new(require('events').EventEmitter)();

const Server = apprequire('server');

/**
 * True when startInput has been called
 */
let started = false;

/**
 * Send a message to the user
 * @param {String} res	Chat ID 
 * @param {*} text Text to send
 * @param {*} opt Additional bot options
 */
async function sendMessage(res, text, fulfillment) {
	res.json({
		text: text,
		fulfillment: fulfillment
	});
}

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

	const res = session.res;
	delete session.res;

	// Process an error
	try {
		if (f.data.error) {
			if (f.data.error.speech) {
				await sendMessage(res, f.data.error.speech, f);
			}
			if (session.is_admin) {
				await sendMessage(res, 'ERROR: <code>' + JSON.stringify(f.data.error) + '</code>');
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Speech Object
	try {
		const speech = f.speech || f.data.speech;
		if (speech) {
			await sendMessage(res, speech, f);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a URL Object
	try {
		if (f.data.url) {
			await sendMessage(res, f.data.url, f);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Music object
	try {
		if (f.data.music) {
			if (f.data.music.spotify) {
				if (f.data.music.spotify.track) {
					await sendMessage(res, f.data.music.spotify.track.share_url, f);
				}
				if (f.data.music.spotify.album) {
					await sendMessage(res, f.data.music.spotify.album.share_url, f);
				}
				if (f.data.music.spotify.artist) {
					await sendMessage(res, f.data.music.spotify.artist.share_url, f);
				}
				if (f.data.music.spotify.playlist) {
					await sendMessage(res, f.data.music.spotify.playlist.share_url, f);
				}
			} else if (f.data.music.uri) {
				await sendMessage(res, f.data.music.uri, f);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Video object
	try {
		if (f.data.video) {
			if (f.data.video.uri) {
				await sendMessage(res, f.data.video.uri, f);
			} else if (f.data.video.youtube) {
				await sendMessage(res, 'https://www.youtube.com/watch?v=' + f.data.video.youtube.id, f);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process an Image Object
	try {
		if (f.data.image) {
			if (f.data.image.uri) {
				await sendMessage(res, f.data.image.uri, f);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process an Audio Object
	try {
		if (f.data.audio) {
			if (f.data.audio.uri) {
				await sendMessage(res, f.data.audio.uri, f);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Voice Object
	try {
		if (f.data.voice) {
			if (f.data.voice.uri) {
				// TODO
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Document Object
	try {
		if (f.data.document) {
			if (f.data.document.uri) {
				await sendMessage(res, f.data.document.uri, f);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Lyrics object
	try {
		if (f.data.lyrics) {
			await sendMessage(res, f.data.lyrics.text, f);
		}
	} catch (err) {
		console.error(TAG, err);
	}
};