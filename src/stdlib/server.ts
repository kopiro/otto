import http from "http";
import express from "express";
import config from "../config";
import { publicDir, tmpDir } from "../paths";
import { getVoiceFileFromText } from "./voice-helpers";
import { TextToSpeech } from "./text-to-speech";
import { IOManager } from "./io-manager";
// @ts-ignore
import rateLimit from "express-rate-limit";
import { Signale } from "signale";
import { IOChannel } from "../data/io-channel";
import { Person } from "../data/person";
import { Translator } from "./translator";
import { Authorization, Gender, Language } from "../types";
import { AIVectorMemory, MemoryType } from "./ai/ai-vectormemory";
import { throwIfMissingAuthorizations } from "../helpers";

const TAG = "Server";
const logger = new Signale({
  scope: TAG,
  types: {
    request: {
      badge: "",
      color: "blue",
      label: "request",
      logLevel: "debug",
    },
  },
});

export const routerIO = express.Router();
export const routerApi = express.Router();

// Routers

// API Router

routerApi.use(express.json());
routerApi.use(express.urlencoded({ extended: true }));

// API to get an audio
// GET /api/speech?text=Hello
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  try {
    if (!req.query.text) throw new Error("No text provided");

    if (!req.query.person) throw new Error("PersonID is required");
    await Person.findByIdOrThrow(req.query.person.toString());

    const text = req.query.text.toString();
    const audioFileMixed = await getVoiceFileFromText(text);
    res.redirect(audioFileMixed.getServerURL());
  } catch (err) {
    return res.status(400).json({
      error: (err as Error)?.message,
    });
  }
});

// API to get an audio
// GET /api/user-speech?text=Hello&gender=female
routerApi.get("/user-speech", async (req: express.Request, res: express.Response) => {
  try {
    if (!req.query.text) throw new Error("No text provided");
    if (!req.query.gender) throw new Error("No gender provided");

    if (!req.query.person) throw new Error("PersonID is required");
    await Person.findByIdOrThrow(req.query.person.toString());

    const text = req.query.text.toString();
    const gender = req.query.gender.toString();

    const language = await Translator.getInstance().detectLanguage(text);
    const audioFileMixed = await TextToSpeech.getInstance().getAudioFile(text, language as Language, gender as Gender);
    res.redirect(audioFileMixed.getServerURL());
  } catch (err) {
    return res.status(400).json({
      error: (err as Error)?.message,
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
        message: (err as Error)?.message,
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
    if (!req.query.io_channel) throw new Error("req.body.io_channel is required");

    const ioChannel = await IOChannel.findByIdOrThrow(req.query.io_channel.toString());
    return res.json({ status: Boolean(ioChannel.doNotDisturb) });
  } catch (err) {
    logger.error("/api/dnd error", err);
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
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
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.get(`/memory/:memoryType`, async (req, res) => {
  try {
    if (!req.query.person) throw new Error("PersonID is required");
    const person = await Person.findByIdOrThrow(req.query.person.toString());

    throwIfMissingAuthorizations(person.authorizations, [Authorization.ADMIN]);

    const memoryType = req.params.memoryType.toString();
    const vectors = await AIVectorMemory.getInstance().listVectors(memoryType as MemoryType);

    res.json({ data: vectors });
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

export function getDomain(): string {
  return `${config().server.protocol}://${config().server.domain}`;
}

export function initializeRoutes(): { app: any; server: http.Server } {
  const app = express();
  const server = http.createServer(app);

  app.set("trust proxy", 1);

  // Log all requests
  app.use((req, res, next) => {
    logger.request(`${req.method} ${req.url}`);
    next();
  });

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
        logger.success(`Started (on ${conf.protocol}://${conf.domain})`);
        resolve();
      },
    );
  });
}
