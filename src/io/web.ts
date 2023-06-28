import { EventEmitter } from "events";
import { IODriverRuntime, IODriverOutput, IODriverEventMap, IODriverId } from "../stdlib/io-manager";
import { Fulfillment, InputParams, Language } from "../types";
import { Request, Response } from "express";
import { routerIO } from "../stdlib/server";
import bodyParser from "body-parser";
import { Signale } from "signale";
import { formidable } from "formidable";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { getVoiceFileFromFulfillment } from "../stdlib/voice-helpers";
import { File } from "../stdlib/file";
import { IOChannel, TIOChannel } from "../data/io-channel";
import { rename } from "fs/promises";
import { Person, TPerson } from "../data/person";
import TypedEmitter from "typed-emitter";

const TAG = "IO.Web";
const logger = new Signale({
  scope: TAG,
});

const TIMEOUT_MS = 10_000;

type WebConfig = null;

export type IODataWeb = {
  userAgent: string;
  ip: string;
};

export type IOBagWeb = {
  req: Request;
  res: Response;
  timeoutTick: NodeJS.Timeout;
};

export class Web implements IODriverRuntime {
  driverId: IODriverId = "web";

  emitter = new EventEmitter() as TypedEmitter<IODriverEventMap>;

  config: WebConfig;
  started = false;

  constructor(config: WebConfig) {
    this.config = config;
  }

  async maybeHandleVoice(req: Request, language: Language): Promise<string | null> {
    const form = formidable();
    const { files } = await new Promise<{ files: { voice: { path: string } } }>((resolve, reject) => {
      form.parse(req, (err: any, _: any, files: any) => {
        if (err) {
          return reject(err);
        }
        resolve({ files });
      });
    });

    if (!files.voice) return null;

    const tmpAudioFile = File.getTmpFile("wav");
    await rename(files.voice.path, tmpAudioFile.getAbsolutePath());

    const text = await SpeechRecognizer.getInstance().recognizeFile(tmpAudioFile.getAbsolutePath(), language);
    if (!text) return null;

    return text;
  }

  async onRequest(req: Request, res: Response) {
    logger.debug("New request with query =", req.query, "body =", req.body);

    if (!req.body.io_channel) throw new Error("req.body.io_channel is required");
    if (!req.body.person) throw new Error("req.body.person is required");

    // TODO: Use username maybe
    const person = await Person.findByIdOrThrow(req.body.person);

    const ioChannel = await IOChannel.findByIOIdentifierOrCreate(
      this.driverId,
      // TODO: rename this to io_channel_identifier
      req.body.io_channel,
      {
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      },
      person,
    );

    const params = (req.body.params || {}) as InputParams;

    // Populate text by voice if necessary
    if (!params.text) {
      params.text = await this.maybeHandleVoice(req, person.language);
    }

    const timeoutTick = setTimeout(() => {
      if (!res.closed) {
        res.status(408).json({ error: { message: "Lost connection with the driver" } });
      }
    }, TIMEOUT_MS);

    this.emitter.emit("input", params, ioChannel, person, { req, res, timeoutTick });
  }

  async output(
    fulfillment: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson | null,
    bag: IOBagWeb,
  ): Promise<IODriverOutput> {
    const { req, res, timeoutTick } = bag;

    if (!req || !res) {
      throw new Error("IO.Web requires a bag with {req,res} (you can't output directly from another driver)");
    }

    if (timeoutTick) {
      clearTimeout(timeoutTick);
    }

    try {
      if (fulfillment.text) {
        const textToSpeechOp = req.body.text_to_speech;
        if (textToSpeechOp) {
          const voiceFile = await getVoiceFileFromFulfillment(fulfillment, person.language);
          fulfillment.voice = voiceFile.getRelativePath();
          if (textToSpeechOp === "redirect") {
            res.redirect(fulfillment.voice);
            return [["ok_with_redirect", fulfillment.voice]];
            return;
          }
        }
      }

      const response = { fulfillment };
      res.json(response);
      return [["ok", response]];
    } catch (err) {
      res.json(400).json({ error: { message: err.message } });
      return [["error", err]];
    }
  }

  async start() {
    if (this.started) return;
    this.started = true;

    // Attach the route
    routerIO.post("/web", bodyParser.json(), async (req: Request, res: Response) => {
      try {
        await this.onRequest(req, res);
      } catch (err) {
        res.status(500).json({ error: { message: err.message, preliminary: true } });
      }
    });
  }
}

let _instance: Web;
export default (): Web => {
  _instance = _instance || new Web(null);
  return _instance;
};
