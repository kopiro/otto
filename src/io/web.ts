import Events from "events";
import { IODriverRuntime, IODriverOutput } from "../stdlib/iomanager";
import { Fulfillment } from "../types";
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

const TAG = "IO.Web";
const logger = new Signale({
  scope: TAG,
});

const DRIVER_ID = "web";

type WebConfig = null;

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

  output(): Promise<IODriverOutput> {
    throw new Error("IODriver.Web doesn't support direct output");
  }

  async requestEndpoint(req: Request, res: Response) {
    if (!req.body.sessionId) {
      throw new Error("body.sessionId is required");
    }

    const session = await Session.findById(req.body.sessionId);
    if (!session) {
      throw new Error(`Session with ID <${req.body.sessionId}> not found`);
    }

    let resolvedInput = false;
    let fulfillment: Fulfillment | null | undefined;

    // First check if the request contains any text or event
    if (req.body.params) {
      resolvedInput = true;
      fulfillment = await AIManager.getInstance().getFullfilmentForInput(req.body.params, session);
    } else {
      // Otherwise, parse for incoming audio
      const form = formidable();
      const { files } = await new Promise<{ files: { audio: { path: string } } }>((resolve, reject) => {
        form.parse(req, (err: any, _: any, files: any) => {
          if (err) {
            return reject(err);
          }
          resolve({ files });
        });
      });

      if (files.audio) {
        resolvedInput = true;

        const tmpAudioFile = File.getTmpFile("wav");
        fs.renameSync(files.audio.path, tmpAudioFile.getAbsolutePath());
        const text = await SpeechRecognizer.getInstance().recognizeFile(
          tmpAudioFile.getAbsolutePath(),
          session.getLanguage(),
        );

        fulfillment = await AIManager.getInstance().getFullfilmentForInput(
          {
            text,
          },
          session,
        );
      }
    }

    if (!resolvedInput) {
      throw new Error("Unable to find a suitable input: body.params OR files.audio");
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
        res.status(400).json({ error: { message: String(err) } });
      }
    });
  }
}

let _instance: Web;
export default (): Web => {
  _instance = _instance || new Web(null);
  return _instance;
};
