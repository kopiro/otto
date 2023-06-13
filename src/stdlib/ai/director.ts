import * as IOManager from "../iomanager";
import config from "../../config";
import { Fulfillment, InputParams, Session, InputSource } from "../../types";
import Events from "events";
import translator from "../translator";
import { Signale } from "signale";
import { createInteraction, getSessionTranslateFrom, getSessionTranslateTo, isJsonString } from "../../helpers";
import { AICommander } from "./commander";
import { AIOpenAI } from "./openai";
import { AIDialogFlow } from "./dialogflow";

const TAG = "AI";
const console = new Signale({
  scope: TAG,
});

export class AIDirector {
  private static instance: AIDirector;
  static getInstance(): AIDirector {
    if (!AIDirector.instance) {
      AIDirector.instance = new AIDirector();
    }
    return AIDirector.instance;
  }

  emitter: Events.EventEmitter = new Events.EventEmitter();

  /**
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentFinalizer(
    fulfillment: Fulfillment | null,
    session: Session,
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
      const { translateFrom = config().language, translateTo = getSessionTranslateTo(session) } =
        fulfillment.options || {};
      if (translatePolicy === "always" || (translatePolicy === "when_necessary" && translateFrom !== translateTo)) {
        try {
          fulfillment.text = await translator().translate(fulfillment.text, translateTo);
        } catch (err) {
          fulfillment.text += ` [untranslated]`;
        }
      }
    }

    // Add other info
    fulfillment.runtime.finalizerUid = config().uid;
    fulfillment.runtime.finalizedAt = Date.now();
    fulfillment.analytics.sessionId = session.id;

    // Create interaction before adding final options
    createInteraction(session, {
      fulfillment,
      source,
    });

    return fulfillment;
  }

  async textRequest(params: InputParams, session: Session): Promise<Fulfillment | null> {
    const { text } = params;
    console.info("text request:", text);

    return AIOpenAI.getInstance().getFulfillmentForInput(params, session, "user", "all");
  }

  async eventRequest(params: InputParams, session: Session): Promise<Fulfillment | null> {
    const { event } = params;
    console.info("event request:", event);

    createInteraction(session, {
      input: { event },
    });

    return AIDialogFlow.getInstance().getFulfillmentForInput(params, session);
  }

  async commandRequest(params: InputParams, session: Session): Promise<Fulfillment> {
    const { command } = params;
    console.info("command request:", command);

    createInteraction(session, {
      input: { command },
    });

    return AICommander.getInstance().getFulfillmentForInput(params, session);
  }

  async getFullfilmentForInput(params: InputParams, session: Session): Promise<Fulfillment | null> {
    let fulfillment: any = null;
    let source: InputSource = "unknown";

    createInteraction(session, {
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
      console.warn("No suitable inputs params in the request");
    }

    const finalFulfillment = await this.fulfillmentFinalizer(fulfillment, session, source);
    return finalFulfillment;
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: Session) {
    console.info("input", params, session.id);
    const fulfillment = await this.getFullfilmentForInput(params, session);
    console.info("output", fulfillment, session.id);
    return IOManager.output(fulfillment, session, params.bag);
  }
}
