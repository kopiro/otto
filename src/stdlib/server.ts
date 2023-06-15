import http from "http";
import express from "express";
import config from "../config";
import { publicDir, cacheDir } from "../paths";
import { getVoiceFileFromURI } from "../stdlib/voice";
import { TextToSpeech } from "./text-to-speech";
import { IOManager } from "./iomanager";
import { AIManager } from "./ai/ai-manager";
// @ts-ignore
import rateLimit from "express-rate-limit";
import { Signale } from "signale";
import { Session } from "../data/session";

const TAG = "Server";
const logger = new Signale({
  scope: TAG,
});

export const routerIO = express.Router();
export const routerApi = express.Router();

// Routers

// API Router

routerApi.use(express.json());
routerApi.use(express.urlencoded({ extended: true }));

// API to get an audio
// GET /api/speech?text=Hello&language=en
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  try {
    if (!req.query.text) throw new Error("No text provided");

    const audioFile = await TextToSpeech.getInstance().getAudioFile(
      req.query.text.toString(),
      req.query.language?.toString() || config().language,
    );
    const audioFileMixed = await getVoiceFileFromURI(audioFile);
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

    const session = await Session.findById(obj.session);
    if (!session) throw new Error("Session not found");

    const output = await AIManager.getInstance().getFullfilmentForInput(obj.params, session);
    return res.json({ data: output });
  } catch (err) {
    logger.error("/api/fulfillment error", err);
    return res.status(400).json({
      error: {
        message: String(err),
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

    const session = await Session.findById(obj.session);
    if (!session) throw new Error("Session not found");

    const output = await IOManager.getInstance().processInput(obj.params, session);
    return res.json({ data: output });
  } catch (err) {
    logger.error("/api/input error", err);
    return res.status(400).json({
      error: {
        message: String(err),
      },
    });
  }
});

// Inform the Queue to process new elements immediately
routerApi.post("/signal/queue", (_, res) => {
  IOManager.getInstance().processQueue((item) => {
    res.json({ item });
  });
});

// Retrieve the DNS status for a session
// GET /api/dnd?session=ID
routerApi.get("/dnd", async (req, res) => {
  try {
    if (!req.query.session) throw new Error("'session' key not provided");

    const session = await Session.findById(req.query.session.toString());
    if (!session) throw new Error("Session not found");

    return res.json({ status: Boolean(session.doNotDisturb) });
  } catch (err) {
    logger.error("/api/dnd error", err);
    return res.status(400).json({
      error: {
        message: String(err),
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

    const session = await Session.findById(req.body.session);
    if (!session) throw new Error("Session not found");

    session.doNotDisturb = Boolean(req.body.status);
    await session.save();

    return res.json({ status: Boolean(session.doNotDisturb) });
  } catch (err) {
    logger.error("/api/dnd error", err);
    return res.status(400).json({
      error: {
        message: String(err),
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

  return { app, server };
}

export function start(): Promise<void> {
  return new Promise<void>((resolve) => {
    const conf = config().server;
    const { server } = initializeRoutes();
    server.listen(
      {
        port: conf.port,
        server: "0.0.0.0",
      },
      () => {
        logger.info(`started: http://0.0.0.0:${conf.port}`);
        resolve();
      },
    );
  });
}
