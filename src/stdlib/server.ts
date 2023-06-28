import http from "http";
import express from "express";
import config from "../config";
import { publicDir, tmpDir } from "../paths";
import { getVoiceFileFromMixedContent } from "./voice-helpers";
import { TextToSpeech } from "./text-to-speech";
import { IOManager } from "./io-manager";
// @ts-ignore
import rateLimit from "express-rate-limit";
import { Signale } from "signale";
import { IOChannel } from "../data/io-channel";
import { Person } from "../data/person";

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
    const audioFileMixed = await getVoiceFileFromMixedContent(audioFile);
    const audioFilePath = audioFileMixed.getRelativePath();

    res.redirect(audioFilePath);
  } catch (err) {
    return res.status(400).json({
      error: err,
    });
  }
});

// API to kick-in input
// POST /api/input { "io_channel": "ID", "person": "ID", "params": { "text": "Hello" } }
routerApi.post("/input", async (req, res) => {
  try {
    if (!req.body.io_channel) throw new Error("req.body.io_channel is required");
    if (!req.body.params) throw new Error("req.body.params is required");
    if (!req.body.person) throw new Error("req.body.person is required");

    const ioChannel = await IOChannel.findByIdOrThrow(req.body.io_channel);
    const person = await Person.findByIdOrThrow(req.body.person);

    const result = await IOManager.getInstance().processInput(req.body.params, ioChannel, person, null);
    return res.json({ result });
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
routerApi.post("/signal/queue", async (_, res) => {
  const item = await IOManager.getInstance().processQueue();
  res.json({ item });
});

// Retrieve the DNS status for a ioChannel
// GET /api/dnd?io_channel=ID
routerApi.get("/dnd", async (req, res) => {
  try {
    if (!req.body.io_channel) throw new Error("req.body.io_channel is required");

    const ioChannel = await IOChannel.findByIdOrThrow(req.query.io_channel.toString());

    return res.json({ status: Boolean(ioChannel.doNotDisturb) });
  } catch (err) {
    logger.error("/api/dnd error", err);
    return res.status(400).json({
      error: {
        message: String(err),
      },
    });
  }
});

// Set the DNS status for a ioChannel
// POST /api/dnd { "io_channel": "ID", "status": true }
routerApi.post("/dnd", async (req, res) => {
  try {
    if (!req.body.io_channel) throw new Error("req.body.io_channel is required");
    if (!("status" in req.body)) throw new Error("req.body.status is required");

    const ioChannel = await IOChannel.findByIdOrThrow(req.body.io_channel);
    ioChannel.doNotDisturb = Boolean(req.body.status);
    await ioChannel.save();

    return res.json({ status: Boolean(ioChannel.doNotDisturb) });
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
  app.use("/tmp", express.static(tmpDir));

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
        logger.info(`Server started (on ${conf.protocol}://${conf.domain})`);
        resolve();
      },
    );
  });
}
