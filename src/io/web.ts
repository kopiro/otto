import { EventEmitter } from "events";
import { IODriverRuntime, IODriverMultiOutput, IODriverEventMap, IODriverId, IOBag } from "../stdlib/io-manager";
import { Fulfillment, Input, Language } from "../types";
import { Request, Response } from "express";
import { routerIO } from "../stdlib/server";
import bodyParser from "body-parser";
import { Signale } from "signale";
import { formidable } from "formidable";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { getVoiceFileFromText } from "../stdlib/voice-helpers";
import { File } from "../stdlib/file";
import { IOChannel, TIOChannel } from "../data/io-channel";
import { rename } from "fs/promises";
import { Person, TPerson } from "../data/person";
import TypedEmitter from "typed-emitter";

const TAG = "IO.Web";
const logger = new Signale({
  scope: TAG,
});

const REQUEST_TIMEOUT_MS = 10_000;

type WebConfig = null;

type TRequest = {
  params: Input;
  person: string;
  text_to_speech?: boolean | "redirect";
};
type TResponse = { fulfillment: Fulfillment; voice?: string } | { error?: { message: string } };

export type IODataWeb = {
  userAgent: string;
  ip: string;
};

export type IOBagWeb = {
  req: Request<undefined, undefined, TRequest>;
  res: Response<TResponse>;
  timeoutTick: NodeJS.Timeout;
};

export class Web implements IODriverRuntime {
  driverId: IODriverId = "web";
  emitter = new EventEmitter() as TypedEmitter<IODriverEventMap>;
  conf: WebConfig;
  started = false;

  constructor(config: WebConfig) {
    this.conf = config;
  }

  async maybeHandleVoice(req: IOBagWeb["req"], language: Language): Promise<string | null> {
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

  async onRequest(req: IOBagWeb["req"], res: IOBagWeb["res"]) {
    try {
      if (!req.body.person) throw new Error("req.body.person is required");

      const person = await Person.findByIdOrThrow(req.body.person);

      const ioChannel = await IOChannel.findByIOIdentifierOrCreate(this.driverId, person.id, null, person, true);

      // Populate text by voice if necessary
      let textInput = null;
      if (!("text" in req.body.params)) {
        textInput = await this.maybeHandleVoice(req, person.language);
      } else {
        textInput = req.body.params.text;
      }

      const params = { ...req.body.params, text: textInput } as Input;

      const timeoutTick = setTimeout(() => {
        if (!res.closed) {
          res.status(408).json({ error: { message: "Lost connection with the driver" } });
        }
      }, REQUEST_TIMEOUT_MS);

      this.emitter.emit("input", params, ioChannel, person, { req, res, timeoutTick });
    } catch (err) {
      res.status(500).json({ error: { message: (err as Error)?.message } });
    }
  }

  async output(f: Fulfillment, ioChannel: TIOChannel, person: TPerson, _bag: IOBag): Promise<IODriverMultiOutput> {
    const bag = _bag as IOBagWeb;
    if (!bag.req || !bag.res) {
      throw new Error("IO.Web requires a bag with {req,res} (you can't output directly from another driver)");
    }

    const { req, res, timeoutTick } = bag;

    if (timeoutTick) {
      clearTimeout(timeoutTick);
    }

    try {
      const response: TResponse = { fulfillment: f };

      if (f.text) {
        const textToSpeechOp = req.body.text_to_speech;
        if (textToSpeechOp) {
          const voiceFile = await getVoiceFileFromText(f.text, person.language);
          response.voice = voiceFile.getServerURL();

          if (textToSpeechOp === "redirect") {
            res.redirect(response.voice);
            return [["ok_with_redirect", response.voice]];
          }
        }
      }

      res.json(response);
      return [["ok", response]];
    } catch (err) {
      res.status(400).json({ error: { message: (err as Error)?.message } });
      return [["error", err]];
    }
  }

  async start() {
    if (this.started) return;
    this.started = true;
    routerIO.post("/web", bodyParser.json(), this.onRequest.bind(this));
  }
}

let _instance: Web;
export default (): Web => {
  _instance = _instance || new Web(null);
  return _instance;
};
