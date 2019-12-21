const request = require("request");
const fs = require("fs");
const path = require("path");
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
const Snowboy = require("snowboy");
const config = require("../config");
const TTS = require("../interfaces/tts");
const Play = require("../lib/play");
const Rec = require("../lib/rec");
const SR = require("../interfaces/sr");
const Messages = require("../lib/messages");
const { storageDir, tmpDir } = require("../paths");
const { cleanText, uuid } = require("../helpers");

const TAG = "HotWord";
let genderId = null;

const _config = config.snowboy;

const PMDL_DIR = path.join(storageDir, "hotwords-pmdl");

async function getModels(forceTraining = false) {
  return new Promise(async (resolve, reject) => {
    if (Snowboy == null) {
      return reject(new Error("Snowboy not installed"));
    }

    const pmdls = {};
    const hotwordModels = new Snowboy.Models();

    Object.entries(_config.hotwords).forEach(([hotword, hotwordConfig]) => {
      pmdls[hotword] = [];

      const dir = path.join(PMDL_DIR, hotword);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const files = fs.readdirSync(dir).filter(file => /\.pmdl$/.test(file));
      const { sensitivity } = hotwordConfig;
      console.debug(
        TAG,
        `added ${files.length} pdml files (${hotword}) with sensitivity = ${sensitivity}`
      );

      files.forEach(file => {
        pmdls[hotword].push(file);
        hotwordModels.add({
          file: path.join(dir, file),
          sensitivity,
          hotwords: hotword
        });
      });
    });

    const trained = {};
    for (const [hotword, files] of Object.entries(pmdls)) {
      if (files.length === 0 || forceTraining) {
        trained[hotword] = false;

        while (trained[hotword] === false) {
          try {
            await startTraining(hotword);
            trained[hotword] = true;
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
    const wavFile = path.join(tmpDir, `hotwords-wavs-${uuid()}.wav`);
    const wavStream = fs.createWriteStream(wavFile);

    Rec.start({
      time: 3
    });
    Rec.getStream().pipe(wavStream);
    Rec.getStream().on("end", () => resolve(wavFile));
  });
}

async function recognizeFromMic() {
  const text = await SR.recognize(Rec.start());
  Rec.stop();
  return text;
}

async function sendWavFiles(opt) {
  return new Promise((resolve, reject) => {
    const pmdlFile = path.join(PMDL_DIR, opt.hotword, `${uuid()}.pmdl`);

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
            name: opt.speech,
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
            Messages.get("io_hotword_training_failed", opt.speech)
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
  const { speech } = _config.hotwords[hotword];

  await sendMessage(Messages.get("io_hotword_training_tutorial", speech));

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
    speech,
    hotword,
    gender: genderId,
    wavFiles
  });

  await sendMessage(Messages.get("io_hotword_training_success", speech));
}

module.exports = { getModels };
