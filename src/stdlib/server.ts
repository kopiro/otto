import http from "http";
import express from "express";

import config from "../config";
import { publicDir, cacheDir } from "../paths";
import voice from "../stdlib/voice";
import bodyParser from "body-parser";
import textToSpeech from "./text-to-speech";
import { getSession } from "./iomanager";
import ai from "./ai";

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

async function speech(res: express.Response, obj: Record<string, any>) {
  try {
    const audioFile = await textToSpeech().getAudioFile(
      obj.text.toString(),
      obj.language?.toString() || config().language,
      obj.gender?.toString() || config().tts.gender,
    );
    const audioFileMixed = await voice().getFile(audioFile);
    const audioFilePath = audioFileMixed.getRelativePath();
    res.redirect(audioFilePath);
  } catch (err) {
    return res.status(400).json({
      error: err,
    });
  }
}

// API to get an audio
routerApi.get("/speech", (req: express.Request, res: express.Response) => speech(res, req.query));
routerApi.post("/speech", (req: express.Request, res: express.Response) => speech(res, req.body));

// API to kick-in input
routerApi.post("/input", async (req, res) => {
  try {
    const obj = req.body;
    if (!obj.session) throw new Error("'session' key not provided");
    if (!obj.params) throw new Error("'params' key not provided");

    const session = await getSession(obj.session);
    if (!session) throw new Error("Session not found");

    const output = await ai().processInput(obj.params, session);
    return res.json({ data: output });
  } catch (err) {
    console.error("/api/input error", err);
    return res.status(400).json({
      error: {
        message: err.message,
      },
    });
  }
});

routerApi.get("/dnd", async (req, res) => {
  try {
    if (!req.query.session) throw new Error("'session' key not provided");
    const session = await getSession(req.query.session.toString());
    if (!session) throw new Error("Session not found");
    return res.json({ status: Boolean(session.doNotDisturb) });
  } catch (err) {
    console.error("/api/dnd error", err);
    return res.status(400).json({
      error: {
        message: err.message,
      },
    });
  }
});

routerApi.post("/dnd", async (req, res) => {
  try {
    if (!req.body.session) throw new Error("'session' key not provided");
    if (!("status" in req.body)) throw new Error("'status' key not provided");
    const session = await getSession(req.body.session);
    if (!session) throw new Error("Session not found");
    session.doNotDisturb = Boolean(req.body.status);
    await session.save();
    return res.json({ status: Boolean(session.doNotDisturb) });
  } catch (err) {
    console.error("/api/dnd error", err);
    return res.status(400).json({
      error: {
        message: err.message,
      },
    });
  }
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
    const { server } = initializeRoutes();
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
