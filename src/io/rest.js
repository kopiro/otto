const TAG = 'IO.Rest';
exports.config = {
	id: 'rest',
	onlyServerMode: true
};

const _config = config.rest;

const emitter = exports.emitter = new(require('events').EventEmitter)();
const request = require('request');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');

const Play = apprequire('play');
const Proc = apprequire('proc');
const SpeechRecognizer = apprequire('gcsr');
const TextToSpeech = apprequire('polly');
const Server = apprequire('server');

/**
 * True when startInput has been called
 */
let started = false;

/**
 * Handle a voice input by recognizing the text
 * @param {Object} session	Current session 
 * @param {Object} e Telegram object
 */
async function handleInputVoice(session, audio_file) {
	return new Promise((resolve, reject) => {
		const tmp_file = path.join(__tmpdir, uuid());
		audio_file.mv(tmp_file, async (err) => {
			if (err) return reject(err);

			try {
				const text = await SpeechRecognizer.recognizeFile(tmp_file, {
					language: session.getTranslateFrom(),
					convertFile: true
				});
				resolve(text);
			} catch (err) {
				reject(err);
			}
		});
	});
}

/**
 * Process an input request by Express
 * @param {Object} req 
 * @param {Object} res 
 */
async function handleRequest(req, res) {
	if (req.query.sessionId == null) {
		throw new Error('Invalid session identifier');
	}

	let outputType = null;
	switch (req.query.outputType) {
		case 'voice':
			outputType = 'voice';
			break;
	}

	console.info(TAG, 'request', req.query, req.body, req.files);

	// Register the session
	const session = await IOManager.registerSession({
		sessionId: req.query.sessionId,
		io_driver: 'rest',
		io_data: req.query,
		text: req.query.text
	});

	session.rest = {
		req: req,
		res: res,
		outputType: outputType
	};

	if (req.body.text) {
		emitter.emit('input', {
			session: session,
			params: {
				text: req.body.text
			}
		});

	} else if (req.files.audio) {
		emitter.emit('input', {
			session: session,
			params: {
				text: (await handleInputVoice(session, req.files.audio))
			}
		});

	} else {
		throw new Error('Unable to understand your request');
	}
}

/**
 * Start the polling/webhook cycle
 */
exports.startInput = function () {
	if (started) return;
	started = true;

	Server.routerIO.use('/rest',
		bodyParser.json(),
		bodyParser.urlencoded(),
		fileUpload({
			abortOnLimit: true,
			limits: {
				fileSize: 5 * 1024 * 1024
			},
		}),
		async (req, res) => {
			try {
				await handleRequest(req, res);
			} catch (err) {
				console.error(TAG, err);
				res.status(400).json({
					error: (err.message ? {
						message: err.message
					} : err)
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

	// Process voice if output type set
	if (session.rest.outputType === 'voice') {
		const speech = f.speech || f.data.speech;
		const language = f.data.language || session.getTranslateTo();

		if (speech != null) {
			const output_file = path.join(__publictmpdir, uuid() + '.mp3');
			await Play.playVoiceToFile(await TextToSpeech.getAudioFile(speech, {
				language: language
			}), output_file);
			f.voice = Server.getAbsoluteURIByRelativeURI('/tmp/' + path.basename(output_file));
		}
	}

	return session.rest.res.json(f);
};