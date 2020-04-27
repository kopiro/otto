import http from "http";
import express from "express";
import bodyParser from "body-parser";
import config from "../config";
import { publicDir, cacheDir, baseDir } from "../paths";
import { webhookEndpoint } from "./ai";
import TextToSpeech from "./text-to-speech";
import { playVoiceToFile } from "../lib/play";
import Storage from "./storage";
import emoj from "emoj";

const TAG = "Server";

const _config = config().server;

export const app = express();
export const server = http.createServer(app);

// Routers

export const routerIO = express.Router();
export const routerApi = express.Router();
export const routerListeners = express.Router();

// API Router

routerApi.use(bodyParser.json());
routerApi.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// Add the fulfillment endpoint for Dialogflow
routerApi.post("/fulfillment", webhookEndpoint);

// API to get an audio
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  const audioFile = await TextToSpeech.getAudioFile(
    req.query.text,
    req.query.language || config().language,
    req.query.gender || config().tts.gender,
  );
  const audioFileMixed = await playVoiceToFile(audioFile);
  res.redirect(audioFileMixed.replace(baseDir, ""));
});

// Expose all possible effects
routerApi.get("/audios", async (req: express.Request, res: express.Response) => {
  const defaultDirectory = await Storage.getDefaultDirectory();
  const [files] = await defaultDirectory.getFiles({ prefix: "audios/" });
  const finalFiles = await Promise.all(
    files
      .filter((file) => /\.(mp3|wav)$/.test(file.name))
      .map(async (file) => {
        const em = await emoj(file.name.match(/\/(.+)\..+$/)[1]);
        return {
          name: file.name,
          emoji: em[0],
          url: [Storage.getPublicBaseURL(), file.name].join("/"),
        };
      }),
  );
  res.json({
    files: finalFiles,
  });
});

// Listeners

routerListeners.use(bodyParser.json());
routerListeners.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// IO

routerIO.use(bodyParser.json());
routerIO.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

app.use(express.static(publicDir));
app.use("/cache", express.static(cacheDir));

// Handle all routers
app.use("/io", routerIO);
app.use("/api", routerApi);
app.use("/listeners", routerListeners);

// Adding policy URL
app.get("/policy", (req, res) => {
  res.end("This bot is used only for fun, it's our monkey plush. It only answers to basic questions.");
});

export function start() {
  server.listen(
    {
      port: _config.port,
      server: "0.0.0.0",
    },
    () => {
      console.info(TAG, `started: http://0.0.0.0:${_config.port}`);
    },
  );
}
