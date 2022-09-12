import Events from "events";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import voice from "../stdlib/voice";
import { Fulfillment, InputParams, Session } from "../types";
import { Request, Response } from "express";
import { routerIO } from "../stdlib/server";
import { getTmpFile } from "../helpers";
import fs from "fs";
import bodyParser from "body-parser";
import { File } from "../stdlib/file";
import textToSpeech from "../stdlib/text-to-speech";
import { Signale } from "signale";

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

  async requestEndpoint(req: Request, res: Response) {
    const session = await IOManager.registerSession(DRIVER_ID, req.body.session, req.headers);

    const bag: WebBag = { req, res };

    // First check if the request contains any text or event
    if (req.body.params) {
      this.emitter.emit("input", {
        session,
        params: {
          ...req.body.params,
          bag,
        } as InputParams,
      });
      return true;
    }

    // Otherwise, parse for incoming audio
    const form = formidable();
    const { files } = await new Promise((resolve, reject) => {
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
      this.emitter.emit("input", {
        session,
        params: {
          audio: tmpAudioFile,
          bag,
        } as InputParams,
      });
      return true;
    }

    throw new Error("Unable to find a suitable input: body.params OR files.audio");
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

  async getVoiceFile(fulfillment: Fulfillment, session: Session): Promise<File> {
    const audioFile = await textToSpeech().getAudioFile(
      fulfillment.text,
      fulfillment.options.language || session.getTranslateTo(),
      config().tts.gender,
    );
    return voice().getFile(audioFile);
  }

  async output(fulfillment: Fulfillment, session: Session, bag: WebBag): Promise<IOManager.IODriverOutput> {
    const { req, res } = bag;
    const accepts = req.headers.accept.split(",").map((e: string) => e.trim());

    let audio: string;
    if (accepts.includes(AcceptHeader.AUDIO)) {
      const audioFile = await this.getVoiceFile(fulfillment, session);
      audio = audioFile.getRelativePath();
    }

    if (accepts[0] === AcceptHeader.AUDIO) {
      res.redirect(audio);
      return [["redirect", audio]];
    }

    const jsonResponse: Record<string, any> = { ...fulfillment, audio };
    res.json(jsonResponse);

    return [["response", jsonResponse]];
  }
}

let _instance: Web;
export default (): Web => {
  _instance = _instance || new Web(config().web);
  return _instance;
};
