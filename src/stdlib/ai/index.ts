import dialogflow, { protos, SessionsClient, IntentsClient } from "@google-cloud/dialogflow";
import * as IOManager from "../iomanager";
import config from "../../config";
import {
  Fulfillment,
  CustomError,
  AIAction,
  InputParams,
  Session,
  FullfillmentStringKeys,
  InputSource,
} from "../../types";
import { struct } from "pb-util";
import Events from "events";
import speechRecognizer from "../speech-recognizer";
import translator from "../translator";
import { Signale } from "signale";
import OpenAI from "./openai";
import { createInteraction, getSessionTranslateFrom, getSessionTranslateTo, isJsonString } from "../../helpers";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import AICommander from "./commander";

export type IDetectIntentResponse = protos.google.cloud.dialogflow.v2.IDetectIntentResponse;
export type IQueryInput = protos.google.cloud.dialogflow.v2.IQueryInput;

const TAG = "AI";
const console = new Signale({
  scope: TAG,
});

type AIConfig = {
  aiName: string;
  uid: string;
  language: string;
  dialogflow: {
    projectId: string;
    environment?: string;
    language: string;
  };
};

class AI {
  dfSessionClient: SessionsClient = new dialogflow.SessionsClient();
  dfIntentsClient: IntentsClient = new dialogflow.IntentsClient();

  emitter: Events.EventEmitter = new Events.EventEmitter();

  dfIntentAgentPath: string;

  constructor(private conf: AIConfig) {
    this.dfIntentAgentPath = this.dfIntentsClient.projectAgentPath(this.conf.dialogflow.projectId);
  }

  /**
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentFinalizer(
    fulfillment: Fulfillment | null,
    session: Session,
    source: InputSource,
  ): Promise<Fulfillment | null> {
    if (!fulfillment) return null;

    console.log("Finalizing fuflillment", fulfillment);

    fulfillment.options = fulfillment.options || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.options.finalizerUid) {
      return fulfillment;
    }

    // Always translate fulfillment speech in the user language
    if (fulfillment.text) {
      const fromLanguage = fulfillment.options.translateFrom ?? this.conf.language;
      const toLanguage = fulfillment.options.translateTo || getSessionTranslateTo(session);
      if (toLanguage !== fromLanguage) {
        try {
          fulfillment.text = await translator().translate(fulfillment.text, toLanguage, fromLanguage);
        } catch (err) {
          fulfillment.text += ` [untranslated]`;
        }
      }
    }

    createInteraction(session, {
      fulfillment,
      source,
    });

    // Add other info
    fulfillment.options.finalizerUid = this.conf.uid;
    fulfillment.options.finalizedAt = Date.now();
    fulfillment.options.sessionId = session.id;

    return fulfillment;
  }

  /**
   * Get the session path suitable for DialogFlow
   */
  getDfSessionPath(sessionId: string) {
    const dfSessionId = sessionId.replace(/\//g, "_");
    if (!this.conf.dialogflow.environment) {
      return this.dfSessionClient.projectAgentSessionPath(this.conf.dialogflow.projectId, dfSessionId);
    }

    return this.dfSessionClient.projectAgentEnvironmentUserSessionPath(
      this.conf.dialogflow.projectId,
      this.conf.dialogflow.environment,
      "-",
      dfSessionId,
    );
  }

  /**
   * Transform an error into a fulfillment
   */
  actionErrorFinalizer(error: CustomError): Fulfillment {
    const fulfillment: Fulfillment = {};
    fulfillment.error = error;
    return fulfillment;
  }

  /**
   * Accept a Generation action and resolve all outputs
   */
  async generatorResolver(
    fulfillmentGenerator: IterableIterator<Fulfillment>,
    session: Session,
    bag: IOManager.IOBag,
    source: InputSource,
  ) {
    console.info("Using generator resolver", fulfillmentGenerator);

    const fulfillmentsAndOutputResults: [Fulfillment | null, IOManager.OutputResult][] = [];

    for await (const fulfillment of fulfillmentGenerator) {
      const finalFulfillment = await this.fulfillmentFinalizer(fulfillment, session, source);
      const outputResult = await IOManager.output(finalFulfillment, session, bag);
      fulfillmentsAndOutputResults.push([finalFulfillment, outputResult]);
    }

    return fulfillmentsAndOutputResults;
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  private async dfActionResolver(
    actionName: string,
    body: IDetectIntentResponse,
    session: Session,
    bag: IOManager.IOBag,
    source: InputSource,
  ): Promise<Fulfillment> {
    console.info(`calling action <${actionName}>`);

    try {
      const [pkgName, pkgAction = "index"] = actionName.split(".");

      if (pkgName.includes("..") || pkgAction.includes("..")) {
        throw new Error(`Unsafe action name <${pkgName}.${pkgAction}>`);
      }

      const pkg = await import(`../../packages/${pkgName}/${pkgAction}`);
      if (!pkg) {
        throw new Error(`Invalid action name <${pkgName}.${actionName}>`);
      }

      const pkgAuthorizations = (pkg.authorizations || []) as IOManager.Authorizations[];
      const sessionAuthorizations = session.authorizations || [];
      for (const pkgAuth of pkgAuthorizations) {
        if (!sessionAuthorizations.includes(pkgAuth)) {
          throw new Error(`Missing ${pkgAuth} authorization for your session`);
        }
      }

      const pkgCallable = pkg.default as AIAction;
      const actionResult = await pkgCallable(body, session, bag);

      // Now check if this action is a Promise or a Generator
      if (actionResult.constructor.name === "GeneratorFunction") {
        // Call the generator async
        setImmediate(() => {
          this.generatorResolver(actionResult as IterableIterator<Fulfillment>, session, bag, source);
        });

        // And immediately resolve
        return {
          options: {
            handledByGenerator: true,
          },
        };
      } else {
        return actionResult as Fulfillment;
      }
    } catch (err) {
      console.error("error while executing action", err);
      return this.actionErrorFinalizer(err);
    }
  }

  extractMessages(fulfillmentMessages: protos.google.cloud.dialogflow.v2.Intent.IMessage[], key: string) {
    return fulfillmentMessages?.find((m) => m?.payload?.fields?.[key] !== undefined)?.payload?.fields?.[key]
      .stringValue;
  }

  /**
   * Parse the DialogFlow body and decide what to do
   */
  private async dfBodyParser(
    body: IDetectIntentResponse,
    session: Session,
    bag: IOManager.IOBag,
    originalRequestType: "text" | "event",
    source: InputSource,
  ): Promise<Fulfillment | null> {
    const { fulfillmentText, fulfillmentMessages, action, intent, queryText, parameters } = body.queryResult || {};

    // If we have an "action", call the package with the specified name
    if (action) {
      console.debug(`Resolving action: ${action}`);
      return this.dfActionResolver(action, body, session, bag, source);
    }

    // Otherwise, check if at least an intent is match and direct return that fulfillment
    if (!intent || intent?.isFallback) {
      if (queryText && originalRequestType === "text") {
        const answerText = await OpenAI().textRequest(queryText, session);
        return { text: answerText };
      }
      return null;
    }

    let maybeOpenAIPrompt = fulfillmentMessages?.find((m) => m?.payload?.fields?.openai_prompt?.stringValue)?.payload
      ?.fields?.openai_prompt?.stringValue;
    if (maybeOpenAIPrompt) {
      for (const [key, value] of Object.entries(parameters?.fields ?? [])) {
        maybeOpenAIPrompt = maybeOpenAIPrompt.replace(new RegExp(`{${key}}`, "g"), value.stringValue || "UNKNOWN");
      }

      const answerText = await OpenAI().textRequest(
        maybeOpenAIPrompt,
        session,
        originalRequestType === "text"
          ? ChatCompletionRequestMessageRoleEnum.User
          : ChatCompletionRequestMessageRoleEnum.System,
      );
      return { text: answerText };
    }

    const spreadFulfillment: Fulfillment = {};
    if (fulfillmentText) {
      spreadFulfillment.text = fulfillmentText;
    }
    for (const key of FullfillmentStringKeys) {
      const value = this.extractMessages(fulfillmentMessages || [], key);
      if (value) spreadFulfillment[key] = value;
    }
    return spreadFulfillment;
  }

  private async dfRequest(queryInput: IQueryInput, session: Session, bag?: IOManager.IOBag) {
    if (queryInput.text?.text) {
      queryInput.text.text = await translator().translate(
        queryInput.text.text,
        this.conf.dialogflow.language,
        getSessionTranslateFrom(session),
      );
    }

    const sessionPath = this.getDfSessionPath(session.id);
    const payload = {
      session: sessionPath,
      queryInput,
      queryParams: {
        payload: bag?.encodable ? struct.encode(bag.encodable) : {},
      },
    };
    const [response] = await this.dfSessionClient.detectIntent(payload);

    return response;
  }

  /**
   * Get the command to execute and return an executor
   */
  async commandRequest(
    command: string,
    session: Session,
    bag: IOManager.IOBag,
    source: InputSource,
  ): Promise<Fulfillment> {
    console.info("command request:", command);

    createInteraction(session, {
      input: { command: command },
    });

    return AICommander().getCommandExecutor(command, session)(session, bag);
  }

  /**
   * Make a text request to DialogFlow and let the flow begin
   */
  async textRequest(
    text: InputParams["text"],
    session: Session,
    bag: IOManager.IOBag,
    source: InputSource,
  ): Promise<Fulfillment | null> {
    console.info("[df] text request:", text);

    const queryInput: IQueryInput = { text: { text } };
    queryInput.text!.languageCode = this.conf.dialogflow.language;

    createInteraction(session, {
      input: { text },
    });

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body, session, bag, "text", source);
  }

  /**
   * Make an event request to DialogFlow and let the flow begin
   */
  async eventRequest(
    event:
      | string
      | {
          name: string;
          parameters?: Record<string, string>;
        },
    session: Session,
    bag: IOManager.IOBag,
    source: InputSource,
  ): Promise<Fulfillment | null> {
    console.info("[df] event request:", event);

    const queryInput: IQueryInput = { event: {} };

    if (typeof event === "string") {
      queryInput.event!.name = event;
    } else {
      queryInput.event!.name = event.name;
      queryInput.event!.parameters = event.parameters ? struct.encode(event.parameters) : {};
    }
    queryInput.event!.languageCode = this.conf.dialogflow.language;

    createInteraction(session, {
      input: { event },
    });

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body, session, bag, "event", source);
  }

  async getFullfilmentForInput(params: InputParams, session: Session): Promise<Fulfillment | null> {
    let fulfillment: any = null;
    let source: InputSource = "unknown";
    if (params.text) {
      source = "text";
      fulfillment = await this.textRequest(params.text, session, params.bag, source);
    } else if (params.event) {
      source = "event";
      fulfillment = await this.eventRequest(params.event, session, params.bag, source);
    } else if (params.audio) {
      source = "voice";
      const text = await speechRecognizer().recognizeFile(params.audio, getSessionTranslateFrom(session));
      fulfillment = await this.textRequest(text, session, params.bag, source);
    } else if (params.command) {
      source = "command";
      fulfillment = await this.commandRequest(params.command, session, params.bag, source);
    } else if (params.repeatText) {
      source = "repeat";
      fulfillment = { text: params.repeatText };
    } else {
      source = "unknown";
      console.warn("Neither { text, event, command, repeatText, audio } in params are not null");
    }

    return this.fulfillmentFinalizer(fulfillment, session, source);
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: Session) {
    console.info("processInput", { params, session });

    // Check if we have repeatModeSessions - if so, just output to all of them
    if (session.repeatModeSessions?.length && params.text) {
      console.info("using repeatModeSessions", session.repeatModeSessions);
      return Promise.all(
        session.repeatModeSessions.map(async (e) => {
          const trFulfillment = await this.fulfillmentFinalizer({ text: params.text }, e, "repeat");
          return IOManager.output(trFulfillment, e, params.bag);
        }),
      );
    }

    const fulfillment = await this.getFullfilmentForInput(params, session);
    return IOManager.output(fulfillment, session, params.bag);
  }
}

let _instance: AI;
export default (): AI => {
  _instance = _instance || new AI(config());
  return _instance;
};
