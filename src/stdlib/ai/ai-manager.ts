import { Fulfillment, Input } from "../../types";
import Events from "events";
import { Signale } from "signale";
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

  async getFullfilmentForInput(input: Input, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    if (!input) {
      throw new Error("Empty params provided");
    }

    if ("text" in input) {
      return AIOpenAI.getInstance().getFulfillmentForInput(input, ioChannel, person);
    } else {
      throw new Error("No valid input provided");
    }
  }
}
