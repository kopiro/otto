import { Fulfillment, InputParams } from "../../types";
import Events from "events";
import { Signale } from "signale";
import { AICommander } from "./ai-commander";
import { AIOpenAI } from "./ai-openai";
import { TIOChannel } from "../../data/io-channel";
import { TPerson } from "../../data/person";

const TAG = "AI";
const logger = new Signale({
  scope: TAG,
});

export class AIManager {
  private static instance: AIManager;
  static getInstance(): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager();
    }
    return AIManager.instance;
  }

  emitter: Events.EventEmitter = new Events.EventEmitter();

  async getFullfilmentForInput(params: InputParams, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    if (!params) {
      throw new Error("Empty params provided");
    }

    if ("text" in params) {
      return AIOpenAI.getInstance().getFulfillmentForInput(params, ioChannel, person);
    } else if ("command" in params) {
      return AICommander.getInstance().getFulfillmentForInput(params, ioChannel, person);
    } else {
      throw new Error("No valid input provided");
    }
  }
}
