import http from "http";
import express from "express";

import config from "../config";
import { publicDir, cacheDir } from "../paths";
import voice from "../stdlib/voice";
import bodyParser from "body-parser";
import textToSpeech from "./text-to-speech";

const TAG = "Server";

export const routerIO = express.Router();
export const routerApi = express.Router();
export const routerOAuth = express.Router();
export const routerListeners = express.Router();

// Routers

// API Router

routerApi.use(bodyParser.json());
routerApi.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// API to get an audio
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  const audioFile = await textToSpeech().getAudioFile(
    req.query.text.toString(),
    req.query.language?.toString() || config().language,
    req.query.gender?.toString() || config().tts.gender,
  );
  const audioFileMixed = await voice().getFile(audioFile);
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

export function getDomain() {
  return `${config().server.protocol}://${config().server.domain}`;
}

export function initializeRoutes() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.static(publicDir));
  app.use("/cache", express.static(cacheDir));

  // Handle all routers
  app.use("/io", routerIO);
  app.use("/api", routerApi);
  app.use("/listeners", routerListeners);
  app.use("/oauth", routerOAuth);

  // Adding policy URL
  app.get("/policy", (req, res) => {
    res.end("This bot is used only for fun, it's our monkey plush. It only answers to basic questions.");
  });

  return { app, server };
}

export function start() {
  return new Promise<void>((resolve, reject) => {
    const _config = config().server;
    const { app, server } = initializeRoutes();
    server.listen(
      {
        port: _config.port,
        server: "0.0.0.0",
      },
      () => {
        console.info(TAG, `started: http://0.0.0.0:${_config.port}`);
        resolve();
      },
    );
  });
}
