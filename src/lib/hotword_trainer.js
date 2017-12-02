const TAG = 'HotWordTrainer';

const request = require('request');
const fs = require('fs');

const Polly = apprequire('polly');
const Play = apprequire('play');
const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Messages = apprequire('messages');

async function sendMessage(text) {
	return Play.fileToSpeaker(await Polly.getAudioFile(text));
}

function listenForHotwordTraining() {
	return new Promise((resolve) => {
		const wav_file = __etcdir + '/hotwords-wavs/' + uuid() + '.wav';
		const wav_stream = fs.createWriteStream(wav_file);
		const rec_stream = Rec.start({ stopOnSilence: true });
		rec_stream.pipe(wav_stream);
		rec_stream.on('end', () => {
			resolve(wav_file);
		});
	});
}

async function recognizeFromMic() {
	let text = await SpeechRecognizer.recognize(Rec.start());
	Rec.stop();
	return text;
}

async function sendWavFiles(opt) {
	return new Promise((resolve, reject) => {
		const pmdl_file = __etcdir + '/hotwords-pmdl/' + uuid() + '.pmdl';

		request.post({
			url: 'https://snowboy.kitt.ai/api/v1/train/',
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				token: config.snowboy.apiKey,
				name: config.snowboy.hotword,
				language: config.language,
				gender: opt.gender_id,
				voice_samples: opt.wav_files.map((wav_file) => {
					return { wave: fs.readFileSync(wav_file).toString('base64') };
				})
			})
		})
		.on('response', async(response) => {
			if (response.statusCode >= 400) {
				await sendMessage(Messages.get('io_hotword_training_failed'));
				console.error(TAG, response.toJSON());
				return reject();
			}

			response.pipe(fs.createWriteStream(pmdl_file))
			.on('close', () => {
				resolve(pmdl_file);
			});
		});
	});
}

async function start() {
	await sendMessage(Messages.get('io_hotword_training_tutorial'));

	const genders_map = Messages.getRaw('io_hotword_training_genders');
	let gender_id = null;
	while (gender_id == null) {
		await sendMessage(Messages.get('io_hotword_training_ask_gender'));
		const gender = cleanText(await recognizeFromMic());
		gender_id = genders_map[gender];
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

	const pmdl_file = await sendWavFiles({
		gender: gender_id,
		wav_files: wav_files
	});

	await sendMessage(Messages.get('io_hotword_training_success'));

	return pmdl_file;
}

exports.start = start;