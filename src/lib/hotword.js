const request = require("request");
const fs = require("fs");
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
const Snowboy = require("snowboy");
const config = require("../config");
const TTS = require("../interfaces/tts");
const Play = require("../lib/play");
const Rec = require("../lib/rec");
const SR = require("../interfaces/sr");
const Messages = require("../lib/messages");
const { etcDir } = require("../paths");
const { cleanText, uuid } = require("../helpers");

const TAG = "HotWord";

const PMDL_DIR = `${etcDir}/hotwords-pmdl/`;

let genderId = null;

const _config = config.snowboy;

async function getModels(forceTraining = false) {
  return new Promise(async (resolve, reject) => {
    if (Snowboy == null) {
      return reject(new Error("Snowboy not installed"));
    }

    let directories = fs.readdirSync(PMDL_DIR);
    directories = directories.filter(e =>
      fs.statSync(PMDL_DIR + e).isDirectory()
    );

    const pmdls = {};
    const hotwordModels = new Snowboy.Models();

    directories.forEach(dir => {
      dir = String(dir);
      pmdls[dir] = [];

      let files = fs.readdirSync(PMDL_DIR + dir);
      files = files.filter(file => /\.pmdl$/.test(file));

      const sens = _config.sensitivity[dir];
      console.debug(
        TAG,
        `added ${files.length} pdml files (${dir}) with sensitivity = ${sens}`
      );

      files.forEach(file => {
        pmdls[dir].push(file);
        hotwordModels.add({
          file: `${PMDL_DIR + dir}/${String(file)}`,
          sensitivity: _config.sensitivity[dir],
          hotwords: dir
        });
      });
    });

    const trained = {};
    for (const dir of Object.keys(pmdls)) {
      if (pmdls[dir].length === 0 || forceTraining === true) {
        trained[dir] = false;
        while (trained[dir] === false) {
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
    return resolve(await getModels());
  });
}

async function sendMessage(text) {
  return Play.playVoice(await TTS.getAudioFile(text));
}

function listenForHotwordTraining() {
  return new Promise(resolve => {
    const wavFile = `${etcDir}/hotwords-wavs/${uuid()}.wav`;
    const wavStream = fs.createWriteStream(wavFile);

    Rec.start({
      time: 3
    });
    Rec.getStream().pipe(wavStream);
    Rec.getStream().on("end", () => {
      resolve(wavFile);
    });
  });
}

async function recognizeFromMic() {
  const text = await SR.recognize(Rec.start());
  Rec.stop();
  return text;
}

async function sendWavFiles(opt) {
  return new Promise((resolve, reject) => {
    const pmdlFile = `${etcDir}/hotwords-pmdl/${opt.hotword}/${uuid()}.pmdl`;

    console.info(TAG, "sendWav", opt);

    request
      .post(
        {
          url: "https://snowboy.kitt.ai/api/v1/train/",
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            token: config.snowboy.apiKey,
            name: opt.hotwordSpeech,
            language: config.language,
            gender: opt.genderId,
            microphone: "mic",
            voice_samples: opt.wavFiles.map(wavFile => ({
              wave: fs.readFileSync(wavFile).toString("base64")
            }))
          })
        },
        (err, response, body) => {
          if (response.statusCode >= 400) {
            console.error(TAG, body);
          }
        }
      )
      .on("response", async response => {
        if (response.statusCode >= 400) {
          await sendMessage(
            Messages.get("io_hotword_training_failed", opt.hotwordSpeech)
          );
          return reject();
        }

        return response
          .pipe(fs.createWriteStream(pmdlFile))
          .on("close", () => resolve(pmdlFile));
      });
  });
}

async function startTraining(hotword) {
  const hotwordSpeech = Messages.getRaw("io_hotword_list")[hotword];
  await sendMessage(
    Messages.get("io_hotword_training_tutorial", hotwordSpeech)
  );

  if (genderId == null) {
    const gendersMap = Messages.getRaw("io_hotword_training_genders");
    while (genderId == null) {
      await sendMessage(Messages.get("io_hotword_training_ask_gender"));
      const gender = cleanText(await recognizeFromMic());
      genderId = gendersMap[gender];
    }
  }

  const wavFiles = [];
  for (let i = 0; i < 3; i++) {
    await sendMessage(Messages.get("io_hotword_training_start"));
    try {
      wavFiles.push(await listenForHotwordTraining());
    } catch (err) {
      console.error(TAG, err);
      i--;
    }
  }

  await sendWavFiles({
    hotwordSpeech,
    hotword,
    gender: genderId,
    wavFiles
  });

  await sendMessage(Messages.get("io_hotword_training_success", hotwordSpeech));
}

module.exports = { getModels };
