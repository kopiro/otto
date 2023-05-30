import Events from "events";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import voice from "../stdlib/voice";
import { Fulfillment, InputParams, Session } from "../types";
import { Request, Response } from "express";
import { routerIO } from "../stdlib/server";
import { getSessionTranslateTo, getTmpFile } from "../helpers";
import fs from "fs";
import bodyParser from "body-parser";
import { File } from "../stdlib/file";
import textToSpeech from "../stdlib/text-to-speech";
import { Signale } from "signale";
import ai from "../stdlib/ai";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const formidable = require("formidable");

const TAG = "IO.Web";
const console = new Signale({
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

export class Web implements IOManager.IODriverModule {
  config: WebConfig;
  emitter: Events.EventEmitter;
  started = false;

  constructor(config: WebConfig) {
    this.config = config;
    this.emitter = new Events.EventEmitter();
  }

  output(): Promise<IOManager.IODriverOutput> {
    throw new Error("IODriver.Web doesn't support direct output");
  }

  async requestEndpoint(req: Request, res: Response) {
    if (!req.body.sessionId) {
      throw new Error("body.sessionId is required");
    }

    const session = await IOManager.registerSession(DRIVER_ID, req.body.sessionId, req.headers);

    let resolvedInput = false;
    let fulfillment: Fulfillment;

    // First check if the request contains any text or event
    if (req.body.params) {
      resolvedInput = true;
      fulfillment = await ai().getFullfilmentForInput(req.body.params, session);
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
        const tmpAudioFile = getTmpFile("wav");
        fs.renameSync(files.audio.path, tmpAudioFile);
        resolvedInput = true;
        fulfillment = await ai().getFullfilmentForInput(
          {
            audio: tmpAudioFile,
          },
          session,
        );
      }
    }

    if (!resolvedInput) {
      throw new Error("Unable to find a suitable input: body.params OR files.audio");
    }

    const accepts = req.headers.accept.split(",").map((e: string) => e.trim());

    let audio: string;
    if (accepts.includes(AcceptHeader.AUDIO)) {
      const audioFile = await this.getVoiceFile(fulfillment, session);
      audio = audioFile.getRelativePath();
    }

    if (accepts[0] === AcceptHeader.AUDIO) {
      res.redirect(audio);
      return;
    }

    const jsonResponse: Record<string, any> = { ...fulfillment, audio };
    return res.json(jsonResponse);
  }

  private async getVoiceFile(fulfillment: Fulfillment, session: Session): Promise<File> {
    const audioFile = await textToSpeech().getAudioFile(
      fulfillment.text,
      fulfillment.options.language || getSessionTranslateTo(session),
      config().tts.gender,
    );
    return voice().getFile(audioFile);
  }

  async start() {
    if (this.started) return true;
    this.started = true;

    // Attach the route
    routerIO.post("/web", bodyParser.json(), async (req: Request, res: Response) => {
      try {
        await this.requestEndpoint(req, res);
      } catch (ex) {
        res.status(400).json({ error: { message: ex.message } });
      }
    });

    return true;
  }
}

let _instance: Web;
export default (): Web => {
  _instance = _instance || new Web(null);
  return _instance;
};
