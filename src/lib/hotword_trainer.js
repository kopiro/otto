const TAG = 'HotWordTrainer';

const request = require('request');
const fs = require('fs');

const Polly = apprequire('polly');
const Play = apprequire('play');
const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Messages = apprequire('messages');

let gender_id = null;

async function sendMessage(text) {
	return Play.fileToSpeaker(await Polly.getAudioFile(text));
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
	let text = await SpeechRecognizer.recognize(Rec.start());
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
					return { wave: fs.readFileSync(wav_file).toString('base64') };
				})
			})
		}, (err, response, body) => {
			if (response.statusCode >= 400) {
				console.error(TAG, body);
			}
		})
		.on('response', async(response) => {
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

async function start(hotword) {
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

exports.start = start;