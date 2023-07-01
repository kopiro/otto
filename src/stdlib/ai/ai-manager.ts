import config from "../../config";
import { Fulfillment, InputParams, Language } from "../../types";
import Events from "events";
import { Translator } from "../translator";
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

  /**
   * Transform a Fulfillment by making some edits based on the current ioChannel settings
   */
  async fulfillmentFinalizer(fulfillment: Fulfillment, language: Language): Promise<Fulfillment> {
    fulfillment.runtime = fulfillment.runtime || {};
    fulfillment.options = fulfillment.options || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.runtime.finalizerUid) {
      return fulfillment;
    }

    const { translatePolicy = "never" } = fulfillment.options || {};

    // Always translate fulfillment speech in the user language
    if (fulfillment.text && translatePolicy !== "never") {
      const { translateTo = language } = fulfillment.options || {};
      if (translatePolicy === "always" || (translatePolicy === "when_necessary" && config().language !== translateTo)) {
        try {
          fulfillment.text = await Translator.getInstance().translate(fulfillment.text, translateTo);
        } catch (err) {
          fulfillment.text += ` [untranslated]`;
        }
      }
    }

    // Add other info
    fulfillment.runtime.finalizerUid = config().uid;
    fulfillment.runtime.finalizedAt = Date.now();

    return fulfillment;
  }

  async getFullfilmentForInput(params: InputParams, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    let fulfillment: Fulfillment | null = null;

    try {
      if (params.text) {
        fulfillment = await AIOpenAI.getInstance().getFulfillmentForInput(params, ioChannel, person);
      } else if (params.command) {
        fulfillment = await AICommander.getInstance().getFulfillmentForInput(params, ioChannel, person);
      } else {
        throw new Error("No valid input provided");
      }
    } catch (err) {
      fulfillment = {
        error: {
          message: err.message,
        },
      };
    }

    if (!fulfillment) {
      throw new Error("Fulfillment is null");
    }

    const finalFulfillment = await this.fulfillmentFinalizer(fulfillment, person.language);
    return finalFulfillment;
  }
}
