import config from "../../config";
import { Fulfillment, InputParams, InputSource } from "../../types";
import Events from "events";
import { Translator } from "../translator";
import { Signale } from "signale";
import { AICommander } from "./ai-commander";
import { AIOpenAI } from "./ai-openai";
import { TSession } from "../../data/session";
import { Interaction } from "../../data/interaction";

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
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentFinalizer(
    fulfillment: Fulfillment | null,
    session: TSession,
    source: InputSource,
  ): Promise<Fulfillment | null> {
    if (!fulfillment) return null;

    fulfillment.runtime = fulfillment.runtime || {};
    fulfillment.options = fulfillment.options || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.runtime.finalizerUid) {
      return fulfillment;
    }

    const { translatePolicy = "never" } = fulfillment.options || {};

    // Always translate fulfillment speech in the user language
    if (fulfillment.text && translatePolicy !== "never") {
      const { translateTo = session.getLanguage() } = fulfillment.options || {};
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

    // Create interaction before adding final options
    Interaction.createNew(session, {
      fulfillment,
      source,
    });

    return fulfillment;
  }

  async getFullfilmentForInput(params: InputParams, session: TSession): Promise<Fulfillment | null> {
    let fulfillment: Fulfillment | null = null;
    let source: InputSource = "unknown";

    Interaction.createNew(session, {
      input: params,
    });

    try {
      if (params.text) {
        source = "text";
        fulfillment = await AIOpenAI.getInstance().getFulfillmentForInput(params, session);
      } else if (params.command) {
        source = "command";
        fulfillment = await AICommander.getInstance().getFulfillmentForInput(params, session);
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

    const finalFulfillment = await this.fulfillmentFinalizer(fulfillment, session, source);
    return finalFulfillment;
  }
}
