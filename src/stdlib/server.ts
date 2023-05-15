import http from "http";
import express from "express";

import config from "../config";
import { publicDir, cacheDir } from "../paths";
import voice from "../stdlib/voice";
import textToSpeech from "./text-to-speech";
import { getSession } from "./iomanager";
import ai from "./ai";
import rateLimit from "express-rate-limit";
import * as IOManager from "./iomanager";

import { Signale } from "signale";

const TAG = "Server";
const console = new Signale({
  scope: TAG,
});

export const routerIO = express.Router();
export const routerApi = express.Router();
export const routerOAuth = express.Router();

// Routers

// API Router

routerApi.use(express.json());
routerApi.use(express.urlencoded({ extended: true }));

// API to get an audio
// GET /api/speech?text=Hello&language=en
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  try {
    const audioFile = await textToSpeech().getAudioFile(
      req.query.text.toString(),
      req.query.language?.toString() || config().language,
      config().tts.gender,
    );
    const audioFileMixed = await voice().getFile(audioFile);
    const audioFilePath = audioFileMixed.getRelativePath();
    res.redirect(audioFilePath);
  } catch (err) {
    return res.status(400).json({
      error: err,
    });
  }
});

// Get Fullfilment for a given input
// GET /api/fulfillment?session=ID&params={ "text": "Hello" }
routerApi.get("/fulfillment", async (req, res) => {
  try {
    const obj = req.body;
    if (!obj.session) throw new Error("'session' key not provided");
    if (!obj.params) throw new Error("'params' key not provided");

    const session = await getSession(obj.session);
    if (!session) throw new Error("Session not found");

    const output = await ai().getFullfilmentForInput(obj.params, session);
    return res.json({ data: output });
  } catch (err) {
    console.error("/api/fulfillment error", err);
    return res.status(400).json({
      error: {
        message: err.message,
      },
    });
  }
});

// API to kick-in input
// POST /api/input { "session": "ID", "params": { "text": "Hello" } }
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

// Inform the Queue to process new elements immediately
routerApi.post("/signal/queue", (_, res) => {
  IOManager.processIOQueue((item) => {
    res.json({ item });
  });
});

// Retrieve the DNS status for a session
// GET /api/dnd?session=ID
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

// Set the DNS status for a session
// POST /api/dnd { "session": "ID", "status": true }
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

export function getDomain(): string {
  return `${config().server.protocol}://${config().server.domain}`;
}

export function initializeRoutes(): { app: any; server: any } {
  const app = express();
  const server = http.createServer(app);

  app.set("trust proxy", 1);

  app.use(express.static(publicDir));
  app.use("/cache", express.static(cacheDir));

  // Handle all routers
  app.use("/io", routerIO);
  app.use(
    "/api",
    rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 100,
    }),
    routerApi,
  );
  app.use("/oauth", routerOAuth);

  return { app, server };
}

export function start(): Promise<void> {
  return new Promise<void>((resolve) => {
    const _config = config().server;
    const { server } = initializeRoutes();
    server.listen(
      {
        port: _config.port,
        server: "0.0.0.0",
      },
      () => {
        console.info(`started: http://0.0.0.0:${_config.port}`);
        resolve();
      },
    );
  });
}
