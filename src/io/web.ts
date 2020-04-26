import Events from "events";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import SpeechRecognizer from "../stdlib/speech-recognizer";
import * as Play from "../lib/play";
import { etcDir } from "../paths";
import TextToSpeech from "../stdlib/text-to-speech";
import { timeout } from "../helpers";
import { Fulfillment, Session } from "../types";
import { Request, Response } from "express";
import { routerIO } from "../stdlib/server";
import { start } from "repl";

const TAG = "IO.Web";
const DRIVER_ID = "web";

type WebConfig = {};
type WebBag = {
  req: Request;
  res: Response;
};

enum RequestedOutput {
  TEXT = "text",
  AUDIO = "audio",
}

class Web implements IOManager.IODriverModule {
  config: WebConfig;
  emitter: Events.EventEmitter;
  started = false;

  constructor(config) {
    this.config = config;
    this.emitter = new Events.EventEmitter();
  }

  async requestEndpoint(req: Request, res: Response) {
    const sessionId = req.body.sessionId;
    const session = await IOManager.registerSession(DRIVER_ID, sessionId, req.headers);
    const bag: WebBag = { req, res };

    if (req.body.text) {
      const text = req.body.text;
      this.emitter.emit("input", {
        session,
        params: {
          text,
          bag,
        },
      });
      return true;
    }

    throw new Error("Unable to find a suitable input");
  }

  start() {
    if (this.started) return;
    this.started = true;

    // Attach the route
    routerIO.post("/web", async (req, res) => {
      try {
        await this.requestEndpoint(req, res);
      } catch (err) {
        res.status(400).json({ error: { message: err.message } });
      }
    });
  }

  async output(fulfillment: Fulfillment, session: Session, bag: WebBag) {
    const { req, res } = bag;

    switch (req.headers["x-accept"] as RequestedOutput) {
      case RequestedOutput.AUDIO:
        {
          const audioFile = await Play.playVoiceToTempFile(fulfillment.audio);
          res.sendFile(audioFile);
        }
        break;
      case RequestedOutput.TEXT:
      default:
        res.send(fulfillment.fulfillmentText);
        break;
    }
  }
}

export default new Web(config().web);
