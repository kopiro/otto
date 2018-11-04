const TAG = 'HotWord';

const request = require('request');
const fs = require('fs');

const TTS = requireInterface('tts');
const Play = apprequire('play');
const Rec = apprequire('rec');
const SR = requireInterface('sr');
const Messages = apprequire('messages');
const {
	Detector,
	Models
} = require('snowboy');

const PMDL_DIR = __etcdir + '/hotwords-pmdl/';

let gender_id = null;

const _config = config.snowboy;

async function getModels(forceTraining = false) {
	return new Promise(async (resolve, reject) => {
		let directories = fs.readdirSync(PMDL_DIR);
		directories = directories.filter((e) => fs.statSync(PMDL_DIR + e).isDirectory());

		let pmdls = {};
		let hotwordModels = new Models();

		directories.forEach((dir) => {
			dir = String(dir);
			pmdls[dir] = [];

			let files = fs.readdirSync(PMDL_DIR + dir);
			files = files.filter((file) => /\.pmdl$/.test(file));

			const sens = _config.sensitivity[dir];
			console.debug(TAG, 'added ' + files.length + ' pdml files (' + dir + ') with sensitivity = ' + sens);

			files.forEach((file) => {
				pmdls[dir].push(file);
				hotwordModels.add({
					file: PMDL_DIR + dir + '/' + String(file),
					sensitivity: _config.sensitivity[dir],
					hotwords: dir
				});
			});
		});

		let trained = {};
		for (let dir of Object.keys(pmdls)) {
			if (pmdls[dir].length === 0 || forceTraining === true) {
				trained[dir] = false;
				while (false === trained[dir]) {
					try {
						await startTraining(dir);
						trained[dir] = true;
					} catch (err) {
						console.error(TAG, err);
					}
				}
			}
		}

		if (Object.keys(trained).length === 0) {
			return resolve(hotwordModels);
		}

		// Recall scanForHotword to rescan pmdls
		resolve(await getModels());
	});
}

async function sendMessage(text) {
	return Play.voiceToSpeaker(await TTS.getAudioFile(text));
}

function listenForHotwordTraining() {
	return new Promise((resolve) => {
		const wav_file = __etcdir + '/hotwords-wavs/' + uuid() + '.wav';
		const wav_stream = fs.createWriteStream(wav_file);

		Rec.start({
			time: 3
		});
		Rec.getStream().pipe(wav_stream);
		Rec.getStream().on('end', () => {
			resolve(wav_file);
		});
	});
}

async function recognizeFromMic() {
	let text = await SR.recognize(Rec.start());
	Rec.stop();
	return text;
}

async function sendWavFiles(opt) {
	return new Promise((resolve, reject) => {
		const pmdl_file = __etcdir + '/hotwords-pmdl/' + opt.hotword + '/' + uuid() + '.pmdl';

		console.info(TAG, 'sendWav', opt);

		request.post({
				url: 'https://snowboy.kitt.ai/api/v1/train/',
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					token: config.snowboy.apiKey,
					name: opt.hotwordSpeech,
					language: config.language,
					gender: opt.gender_id,
					microphone: "mic",
					voice_samples: opt.wav_files.map((wav_file) => {
						return {
							wave: fs.readFileSync(wav_file).toString('base64')
						};
					})
				})
			}, (err, response, body) => {
				if (response.statusCode >= 400) {
					console.error(TAG, body);
				}
			})
			.on('response', async (response) => {
				if (response.statusCode >= 400) {
					await sendMessage(Messages.get('io_hotword_training_failed', opt.hotwordSpeech));
					return reject();
				}

				response.pipe(fs.createWriteStream(pmdl_file))
					.on('close', () => {
						resolve(pmdl_file);
					});
			});
	});
}

async function startTraining(hotword) {
	let hotwordSpeech = Messages.getRaw('io_hotword_list')[hotword];
	await sendMessage(Messages.get('io_hotword_training_tutorial', hotwordSpeech));

	if (gender_id == null) {
		const genders_map = Messages.getRaw('io_hotword_training_genders');
		while (gender_id == null) {
			await sendMessage(Messages.get('io_hotword_training_ask_gender'));
			const gender = cleanText(await recognizeFromMic());
			gender_id = genders_map[gender];
		}
	}

	const wav_files = [];
	for (let i = 0; i < 3; i++) {
		await sendMessage(Messages.get('io_hotword_training_start'));
		try {
			wav_files.push(await listenForHotwordTraining());
		} catch (err) {
			console.error(TAG, err);
			i--;
		}
	}

	await sendWavFiles({
		hotwordSpeech: hotwordSpeech,
		hotword: hotword,
		gender: gender_id,
		wav_files: wav_files
	});

	await sendMessage(Messages.get('io_hotword_training_success', hotwordSpeech));
}

exports.getModels = getModels;