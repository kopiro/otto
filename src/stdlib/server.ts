import http from "http";
import express from "express";

import config from "../config";
import { publicDir, cacheDir, baseDir } from "../paths";
import AI from "./ai";
import TextToSpeech from "./text-to-speech";
import Voice from "../stdlib/voice";
import bodyParser from "body-parser";

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

// API to get an audio
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  const audioFile = await TextToSpeech.getAudioFile(
    req.query.text,
    req.query.language || config().language,
    req.query.gender || config().tts.gender,
  );
  const audioFileMixed = await Voice.getFile(audioFile);
  const audioFilePath = audioFileMixed.getRelativePath();
  res.redirect(audioFilePath);
});

// Listeners

routerListeners.use(bodyParser.json());
routerListeners.use(
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
