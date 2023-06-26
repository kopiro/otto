import Events from "events";
import { IODriverRuntime, IODriverOutput } from "../stdlib/iomanager";
import { Fulfillment, InputParams } from "../types";
import { Request, Response } from "express";
import { routerIO } from "../stdlib/server";
import fs from "fs";
import bodyParser from "body-parser";
import { Signale } from "signale";
import { AIManager } from "../stdlib/ai/ai-manager";
import { formidable } from "formidable";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { getVoiceFileFromFulfillment } from "../stdlib/voice";
import { File } from "../stdlib/file";
import { Session } from "../data/session";
import { rename } from "fs/promises";

const TAG = "IO.Web";
const logger = new Signale({
  scope: TAG,
});

const DRIVER_ID = "web";

type WebConfig = null;

type WebBag = {
  req: Request;
  res: Response;
};

enum AcceptHeader {
  TEXT = "text",
  AUDIO = "audio",
}

export class Web implements IODriverRuntime {
  config: WebConfig;
  emitter: Events.EventEmitter;
  started = false;

  constructor(config: WebConfig) {
    this.config = config;
    this.emitter = new Events.EventEmitter();
  }

  output(f: Fulfillment, session: TSession, bag: WebBag): Promise<IODriverOutput> {
    throw new Error("IODriver.Web doesn't support direct output");
  }

  async handleVoice(req: Request) {
    const form = formidable();
    const { files } = await new Promise<{ files: { voice: { path: string } } }>((resolve, reject) => {
      form.parse(req, (err: any, _: any, files: any) => {
        if (err) {
          return reject(err);
        }
        resolve({ files });
      });
    });
    return files.voice;
  }

  async requestEndpoint(req: Request, res: Response) {
    logger.debug("New request with query =", req.query, "body =", req.body);

    if (!req.body.session) {
      throw new Error("body.session is required");
    }

    const session = await Session.findById(req.body.session);
    if (!session) {
      throw new Error(`Session with ID <${req.body.session}> not found`);
    }

    const params = (req.body.params || {}) as InputParams;

    if (!params.text && !params.command) {
      const audio = await this.handleVoice(req);
      if (audio) {
        const tmpAudioFile = File.getTmpFile("wav");
        await rename(audio.path, tmpAudioFile.getAbsolutePath());
        params.text = await SpeechRecognizer.getInstance().recognizeFile(
          tmpAudioFile.getAbsolutePath(),
          session.getLanguage(),
        );
      }
    }

    const fulfillment = await AIManager.getInstance().getFullfilmentForInput(params, session);

    if (fulfillment === undefined) {
      throw new Error("Unable to process your input params");
    }

    const accepts = req.headers.accept?.split(",").map((e: string) => e.trim());

    let audio: string | undefined;

    if (fulfillment) {
      if (accepts?.includes(AcceptHeader.AUDIO)) {
        const audioFile = await getVoiceFileFromFulfillment(fulfillment, session);
        audio = audioFile.getRelativePath();
      }

      if (accepts?.[0] === AcceptHeader.AUDIO) {
        if (!audio) {
          return res.status(400);
        }

        res.redirect(audio);
        return;
      }
    }

    return res.json({ ...fulfillment, audio });
  }

  async start() {
    if (this.started) return;
    this.started = true;

    // Attach the route
    routerIO.post("/web", bodyParser.json(), async (req: Request, res: Response) => {
      try {
        await this.requestEndpoint(req, res);
      } catch (err) {
        res.status(400).json({ error: { message: err.message } });
      }
    });
  }
}

let _instance: Web;
export default (): Web => {
  _instance = _instance || new Web(null);
  return _instance;
};
