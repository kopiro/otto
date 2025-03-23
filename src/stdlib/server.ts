import http from "http";
import express from "express";
import config from "../config";
import { publicDir, tmpDir } from "../paths";
import { getVoiceFileFromText } from "./voice-helpers";
import { TextToSpeech } from "./text-to-speech";
import { IOManager, OutputSource } from "./io-manager";
import rateLimit from "express-rate-limit";
import { Signale } from "signale";
import { IOChannel } from "../data/io-channel";
import { Person } from "../data/person";
import { Translator } from "./translator";
import { Authorization, Gender, Language } from "../types";
import { AIMemory, MemoryType } from "./ai/ai-memory";
import { throwIfMissingAuthorizations } from "../helpers";
import { Database } from "./database";
import { Interaction } from "../data/interaction";

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

routerApi.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const xAuthPerson = req.headers["x-auth-person"] ?? req.query["x-auth-person"] ?? null;
    if (!xAuthPerson) {
      throw new Error("Authorization personID is required");
    }

    const person = await Person.findByIdOrThrow(String(xAuthPerson));
    throwIfMissingAuthorizations(person.authorizations, [Authorization.API]);

    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

// API to get an audio
// GET /api/speech?text=Hello
routerApi.get("/speech", async (req: express.Request, res: express.Response) => {
  try {
    const { text } = req.query;
    if (!text) throw new Error("req.query.text is required");
    const audioFileMixed = await getVoiceFileFromText(text.toString(), config().language);
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
    const { text, gender } = req.query;
    if (!text) throw new Error("req.query.text is required");
    if (!gender) throw new Error("req.query.gender is required");

    const language = await Translator.getInstance().detectLanguage(text.toString());
    const audioFileMixed = await TextToSpeech.getInstance().getAudioFile(
      text.toString(),
      language as Language,
      gender as Gender,
    );
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
    const { io_channel: io_channel_id, input, person: person_id, bag } = req.body;
    if (!input) throw new Error("req.body.params is required");
    if (!io_channel_id) throw new Error("req.body.io_channel is required");
    if (!person_id) throw new Error("req.body.person is required");

    const ioChannel = await IOChannel.findByIdOrThrow(req.body.io_channel);
    const person = await Person.findByIdOrThrow(req.body.person);

    const result = await IOManager.getInstance().input(input, ioChannel, person, bag);
    return res.json(result);
  } catch (err) {
    logger.error("/api/input error", err);
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

// API to kick-in output
// POST /api/output { "io_channel": "ID", "person": "ID", "params": { "text": "Hello" } }
routerApi.post("/output", async (req, res) => {
  try {
    const { io_channel: io_channel_id, output, person: person_id, bag } = req.body;
    if (!output) throw new Error("req.body.params is required");
    if (!io_channel_id) throw new Error("req.body.io_channel is required");
    if (!person_id) throw new Error("req.body.person is required");

    const ioChannel = await IOChannel.findByIdOrThrow(req.body.io_channel);
    const person = await Person.findByIdOrThrow(req.body.person);

    const result = await IOManager.getInstance().output(output, ioChannel, person, bag, {
      source: OutputSource.api,
    });
    return res.json(result);
  } catch (err) {
    logger.error("/api/output error", err);
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.post("/database/update", async (req, res) => {
  if (!req.body.person) throw new Error("req.body.person is required");
  const person = await Person.findByIdOrThrow(req.body.person.toString());
  throwIfMissingAuthorizations(person.authorizations, [Authorization.ADMIN]);

  const { filter, update, table } = req.body;
  if (!filter) throw new Error("req.body.filter is required");
  if (!update) throw new Error("req.body.update is required");
  if (!table) throw new Error("req.body.table is required");

  const result = await Database.getInstance()
    .getMongoose()
    .connection.db.collection(table)
    .updateMany(filter, { $set: update });

  return res.json({ result });
});

routerApi.get(`/memories`, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) throw new Error("req.query.type is required");

    if (!(String(type) in config().memory.vectorial)) {
      throw new Error(`Invalid memory type: ${type}`);
    }

    const vectors = await AIMemory.getInstance().listVectors(type.toString() as MemoryType);
    res.json({ data: vectors });
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.get(`/memories/search`, async (req, res) => {
  try {
    const { type, text } = req.query;
    if (!type) throw new Error("req.query.type is required");
    if (!text) throw new Error("req.query.text is required");

    if (!(String(type) in config().memory.vectorial)) {
      throw new Error(`Invalid memory type: ${type}`);
    }

    const vectors = await AIMemory.getInstance().searchByText(
      text.toString(),
      type as MemoryType,
      config().memory.vectorial[type as MemoryType].limit,
      config().memory.vectorial[type as MemoryType].scoreThreshold,
    );

    res.json({ data: vectors });
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.delete(`/memories/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!id) throw new Error("req.params.id is required");
    if (!type) throw new Error("req.query.type is required");

    if (!(String(type) in config().memory.vectorial)) {
      throw new Error(`Invalid memory type: ${type}`);
    }

    await AIMemory.getInstance().deleteVector(id, type as MemoryType);
    res.json({ success: true });
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

// API that exposes persons
routerApi.get("/persons", async (_, res) => {
  const persons = await Person.find();
  const data = persons.map((person) => person.toJSONAPI());
  res.json({ data });
});

routerApi.get(`/persons/:personId`, async (req, res) => {
  try {
    const { personId } = req.params;
    const person = await Person.findByIdOrThrow(personId);
    res.json(person.toJSONAPI());
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.post(`/persons/:personId/approve`, async (req, res) => {
  try {
    const { personId } = req.params;
    const person = await Person.findByIdOrThrow(personId);
    person.authorizations = person.authorizations || [];
    person.authorizations.push(Authorization.MESSAGE);
    await person.save();
    res.json(person);
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

// API that exposes ioChannels
routerApi.get(`/io_channels`, async (_, res) => {
  const ioChannels = await IOChannel.find({ managerUid: config().uid });
  const data = ioChannels.map((ioChannel) => ioChannel.toJSONAPI());
  res.json({ data });
});

routerApi.get(`/io_channels/:ioChannelId`, async (req, res) => {
  try {
    const { ioChannelId } = req.params;
    const ioChannel = await IOChannel.findByIdOrThrow(ioChannelId);
    res.json(ioChannel.toJSONAPI());
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.get(`/interactions`, async (req, res) => {
  try {
    const { ioChannel, date } = req.query;

    // Build query conditions
    const conditions: any = {};
    if (ioChannel) {
      conditions.ioChannel = ioChannel;
    }
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      conditions.createdAt = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    // Get interactions matching conditions
    const interactions = await Interaction.find(conditions).sort({ createdAt: +1 });

    // Group interactions by channel
    const groupedInteractions = interactions.reduce((acc: Record<string, any>, interaction) => {
      const channelId = interaction.ioChannel.id;

      if (!acc[channelId]) {
        acc[channelId] = {
          channel: new IOChannel(interaction.ioChannel).toJSONAPI(),
          interactions: [],
        };
      }

      acc[channelId].interactions.push(interaction.toJSONAPI());
      return acc;
    }, {});

    res.json({ data: groupedInteractions });
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

routerApi.post(`/admin/brain_reload`, async (req, res) => {
  try {
    const { types } = req.body;
    if (!types) throw new Error("req.body.types is required");

    const result: Record<string, any> = {};
    if (types.includes("prompt")) {
      result.prompt = Boolean(await AIMemory.getInstance().getPrompt(true));
    }
    if (types.includes("declarative")) {
      result.declarative = await AIMemory.getInstance().buildDeclarativeMemory();
    }
    if (types.includes("social")) {
      result.social = await AIMemory.getInstance().buildSocialMemory();
    }
    // if (types.includes("episodic")) {
    //   result.episodic = await AIMemory.getInstance().buildEpisodicMemory();
    // }
    res.json({ result });
  } catch (err) {
    return res.status(400).json({
      error: {
        message: (err as Error)?.message,
      },
    });
  }
});

// Inform the Queue to process new elements immediately
routerApi.post("/admin/queue_process", async (_, res) => {
  const item = await IOManager.getInstance().processQueue();
  res.json({ result: item });
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
      windowMs: 1 * 60_1000,
      max: 100,
    }),
    routerApi,
  );

  return { app, server };
}

export function start(): Promise<void> {
  return new Promise<void>((resolve) => {
    const conf = config().server;
    if (!conf.enabled) {
      return resolve();
    }

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
