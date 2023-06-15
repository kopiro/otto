import config from "../../config";
import { Fulfillment, InputParams, InputSource } from "../../types";
import Events from "events";
import { Translator } from "../translator";
import { Signale } from "signale";
import { AICommander } from "./ai-commander";
import { AIOpenAI } from "./ai-openai";
import { AIDialogFlow } from "./ai-dialogflow";
import { IOManager } from "../iomanager";
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
    fulfillment.analytics = fulfillment.analytics || {};
    fulfillment.options = fulfillment.options || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.runtime.finalizerUid) {
      return fulfillment;
    }

    const { translatePolicy = "when_necessary" } = fulfillment.options || {};

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

  async textRequest(params: InputParams, session: TSession): Promise<Fulfillment | null> {
    const { text } = params;
    logger.info("Text request:", text);

    return AIOpenAI.getInstance().getFulfillmentForInput(params, session, "user");
  }

  async eventRequest(params: InputParams, session: TSession): Promise<Fulfillment | null> {
    const { event } = params;
    logger.info("Event request:", event);

    Interaction.createNew(session, {
      input: { event },
    });

    return AIDialogFlow.getInstance().getFulfillmentForInput(params, session);
  }

  async commandRequest(params: InputParams, session: TSession): Promise<Fulfillment> {
    const { command } = params;
    logger.info("Command request:", command);

    Interaction.createNew(session, {
      input: { command },
    });

    return AICommander.getInstance().getFulfillmentForInput(params, session);
  }

  async getFullfilmentForInput(params: InputParams, session: TSession): Promise<Fulfillment | null> {
    let fulfillment: any = null;
    let source: InputSource = "unknown";

    Interaction.createNew(session, {
      input: params,
    });

    if (params.text) {
      source = "text";
      fulfillment = await this.textRequest(params, session);
    } else if (params.event) {
      source = "event";
      fulfillment = await this.eventRequest(params, session);
    } else if (params.command) {
      source = "command";
      fulfillment = await this.commandRequest(params, session);
    } else {
      source = "unknown";
      logger.warn("No suitable inputs params in the request");
    }

    const finalFulfillment = await this.fulfillmentFinalizer(fulfillment, session, source);
    return finalFulfillment;
  }
}
