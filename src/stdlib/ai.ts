import dialogflow, { protos } from "@google-cloud/dialogflow";
import * as IOManager from "./iomanager";
import config from "../config";
import { extractWithPattern, getLocalObjectFromURI, replaceVariablesInStrings } from "../helpers";
import { Fulfillment, CustomError, AIAction, InputParams, Session } from "../types";
import { struct, Struct } from "pb-util";
import Events from "events";
import { SessionsClient, IntentsClient } from "@google-cloud/dialogflow/build/src/v2";
import fetch from "node-fetch";
import fs from "fs";
import speechRecognizer from "../stdlib/speech-recognizer";
import translator from "../stdlib/translator";

type IStruct = protos.google.protobuf.IStruct;

type IDetectIntentResponse = protos.google.cloud.dialogflow.v2.IDetectIntentResponse;
type IContext = protos.google.cloud.dialogflow.v2.IContext;
type IMessage = protos.google.cloud.dialogflow.v2.Intent.IMessage;
type IQueryInput = protos.google.cloud.dialogflow.v2.IQueryInput;

export type ResponseBody = IDetectIntentResponse & {
  queryResult: {
    parameters: Record<string, any> | null;
    outputContexts: (IContext & { parameters: Record<string, any> })[];
    fulfillmentMessages: (IMessage & { payload: Record<string, any> })[];
  };
};

const TAG = "AI";

type AIConfig = {
  aiName: string;
  uid: string;
  language: string;
  trainingSessionId: string;
  dialogflow: {
    projectId: string;
    environment?: string;
    language: string;
  };
  openai: {
    token: string;
    language: string;
    interactionTTL: number;
    engine: string;
    brainTxtUrl: string;
  };
};

type CommandFunction = (args: RegExpMatchArray, session: Session, bag: IOManager.IOBag) => Promise<Fulfillment>;

class AI {
  config: AIConfig;

  dfSessionClient: SessionsClient = new dialogflow.SessionsClient();
  dfIntentsClient: IntentsClient = new dialogflow.IntentsClient();
  emitter: Events.EventEmitter = new Events.EventEmitter();

  dfIntentAgentPath: string;

  commandMapping: Array<{
    matcher: RegExp;
    executor: CommandFunction;
    description: string;
    authorization?: IOManager.Authorizations;
  }> = [
    {
      matcher: /^\/start$/,
      executor: this.commandStart,
      description: "start - Start the bot",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/textout ([^\s]+) (.+)/,
      executor: this.commandOut,
      description: "textout - [sessionid] [text] - Send a text message to a specific session",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/eventin ([^\s]+) (.+)/,
      executor: this.eventIn,
      description:
        "eventin - [sessionid] [name] [event_object_or_name] - Process an input event for a specific session",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/textin ([^\s]+) (.+)/,
      executor: this.commandIn,
      description: "textin - [sessionid] [text] - Process an input text for a specific session",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/appstop/,
      executor: this.commandAppStop,
      description: "appstop - Cause the application to crash",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/whoami/,
      executor: this.commandWhoami,
      description: "whoami - Get your session",
    },
  ];

  constructor(config: AIConfig) {
    this.config = config;
    this.dfIntentAgentPath = this.dfIntentsClient.agentPath(this.config.dialogflow.projectId);
  }

  getCommandMappingDescription() {
    return this.commandMapping.map(({ description }) => `${description}`).join("\n");
  }

  private async commandNotAuthorized(): Promise<Fulfillment> {
    return { text: "User not authorized" };
  }

  private async commandNotFound(): Promise<Fulfillment> {
    return { text: "Command not found" };
  }

  private async commandAppStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { text: "Scheduled shutdown in 5 seconds" };
  }

  private async commandStart(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    return { text: "HELO" };
  }

  private async commandWhoami(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    return { payload: { data: JSON.stringify(session, null, 2) } };
  }

  private async commandIn([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await this.processInput({ text: cmdText }, cmdSession);
    return { payload: { data: JSON.stringify(result, null, 2) } };
  }

  private async eventIn([, cmdSessionId, cmdEvent]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const event = cmdEvent.startsWith("{") ? JSON.parse(cmdEvent) : cmdEvent;
    const result = await this.processInput({ event: event }, cmdSession);
    return { payload: { data: JSON.stringify(result, null, 2) } };
  }

  private async commandOut([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await IOManager.output({ text: cmdText }, cmdSession, {});
    return { payload: { data: JSON.stringify(result, null, 2) } };
  }

  getCommandExecutor(text: string, session: Session): (session: Session, bag: IOManager.IOBag) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        if (
          session.authorizations.includes(cmd.authorization) ||
          session.authorizations.includes(IOManager.Authorizations.ADMIN) ||
          cmd.authorization == null
        ) {
          return (session: Session, bag: IOManager.IOBag) => cmd.executor.call(this, matches, session, bag);
        } else {
          return () => this.commandNotAuthorized();
        }
      }
    }

    return () => this.commandNotFound();
  }

  decodeIfStruct(s: IStruct): Record<string, any> {
    return s?.fields ? struct.decode(s as Struct) : s;
  }

  /**
   * Decode an IDetectIntentResponse into a fully decodable body
   */
  dfDecodeDetectIntentResponse(body: IDetectIntentResponse): ResponseBody {
    return body as ResponseBody;
  }

  async train(queryText: string, answer: string) {
    console.debug(TAG, "TRAIN request", { queryText, answer });
    const response = await this.dfIntentsClient.createIntent({
      parent: this.dfIntentAgentPath,
      languageCode: this.config.dialogflow.language,
      intent: {
        displayName: `M-TRAIN: ${queryText}`.substr(0, 100),
        trainingPhrases: [
          {
            type: "EXAMPLE",
            parts: [{ text: queryText }],
          },
        ],
        messages: [
          {
            text: {
              text: [answer],
            },
          },
        ],
      },
    });
    console.debug(TAG, "TRAIN response", response);
    return response;
  }

  /**
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentTransformerForSession(fulfillment: Fulfillment, session: Session): Promise<Fulfillment> {
    if (!fulfillment) return;

    fulfillment.payload = fulfillment.payload || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.payload.transformerUid) {
      return fulfillment;
    }

    // Always translate fulfillment speech in the user language
    if (fulfillment.text) {
      const fromLanguage = fulfillment.payload.translateFrom ?? this.config.language;
      const toLanguage = fulfillment.payload.translateTo || session.getTranslateTo();
      if (toLanguage !== fromLanguage) {
        fulfillment.text = await translator().translate(fulfillment.text, toLanguage, fromLanguage);
      }
    }

    fulfillment.payload.transformerUid = this.config.uid;
    fulfillment.payload.transformedAt = Date.now();

    return fulfillment;
  }

  /**
   * Get the session path suitable for DialogFlow
   */
  getDFSessionPath(session: Session) {
    const dfSessionId = session.id.replace(/\//g, "_");
    if (!this.config.dialogflow.environment) {
      return this.dfSessionClient.projectAgentSessionPath(this.config.dialogflow.projectId, dfSessionId);
    }

    return this.dfSessionClient.projectAgentEnvironmentUserSessionPath(
      this.config.dialogflow.projectId,
      this.config.dialogflow.environment,
      "-",
      dfSessionId,
    );
  }

  /**
   * Transform an error into a fulfillment
   */
  actionErrorTransformer(body: ResponseBody, error: CustomError): Fulfillment {
    const fulfillment: Fulfillment = {};

    if (error.message) {
      const errMessage = error.message;
      const textInPayload = extractWithPattern(body.queryResult.fulfillmentMessages, `[].payload.error.${errMessage}`);
      if (textInPayload) {
        // If an error occurs, try to intercept this error
        // in the fulfillmentMessages that comes from DialogFlow
        let text = textInPayload;
        if (error.data) {
          text = replaceVariablesInStrings(text, error.data);
        }
        fulfillment.text = text;
      }
    }

    // Add anyway the complete error
    fulfillment.payload = { error };

    return fulfillment;
  }

  /**
   * Accept a Generation action and resolve all outputs
   */
  async generatorResolver(
    body: ResponseBody,
    fulfillmentGenerator: IterableIterator<Fulfillment>,
    session: Session,
    bag: IOManager.IOBag,
  ): Promise<[Fulfillment, IOManager.OutputResult][]> {
    console.info(TAG, "Using generator resolver", fulfillmentGenerator);

    const fulfillmentsAndOutputResults: [Fulfillment, IOManager.OutputResult][] = [];

    for await (const fulfillment of fulfillmentGenerator) {
      let outputResult: IOManager.OutputResult;
      let trFulfillment: Fulfillment;

      try {
        trFulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);
        outputResult = await IOManager.output(trFulfillment, session, bag);
      } catch (err) {
        console.error(TAG, "error while executing action generator", err);
        trFulfillment = this.actionErrorTransformer(body, err);
        trFulfillment = await this.fulfillmentTransformerForSession(trFulfillment, session);
        outputResult = await IOManager.output(trFulfillment, session, bag);
      }

      fulfillmentsAndOutputResults.push([trFulfillment, outputResult]);
    }

    return fulfillmentsAndOutputResults;
  }

  handleSystemPackages(pkgName: string, body: ResponseBody, session: Session): Fulfillment | null {
    const { queryResult } = body;

    switch (pkgName) {
      case "train":
        this.train(queryResult.outputContexts[0].parameters.queryText, queryResult.queryText);
        return body.queryResult;

      case "do_not_disturb_on":
        this.doNotDisturb(true, session);
        return body.queryResult;

      case "do_not_disturb_off":
        this.doNotDisturb(false, session);
        return body.queryResult;

      default:
        return null;
    }
  }

  doNotDisturb(value: boolean, session: Session) {
    console.log(TAG, `setting doNotDisturb to ${value}`, session);
    session.doNotDisturb = value;
    return session.save();
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  async actionResolver(
    actionName: string,
    body: ResponseBody,
    session: Session,
    bag: IOManager.IOBag,
  ): Promise<Fulfillment> {
    console.info(TAG, `calling action <${actionName}>`);

    try {
      const [pkgName, pkgAction = "index"] = actionName.split(".");

      const sysPkgFullfillment = this.handleSystemPackages(pkgName, body, session);
      if (sysPkgFullfillment !== null) {
        return sysPkgFullfillment;
      }

      // TODO: avoid possible code injection
      const pkg = await import(`../packages/${pkgName}/${pkgAction}`);
      if (!pkg) {
        throw new Error(`Invalid action name <${actionName}>`);
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
          this.generatorResolver(body, actionResult as IterableIterator<Fulfillment>, session, bag);
        });

        // And immediately resolve
        return {
          payload: {
            handledByGenerator: true,
          },
        };
      } else {
        return actionResult as Fulfillment;
      }
    } catch (err) {
      console.error(TAG, "error while executing action:", err);
      return this.actionErrorTransformer(body, err);
    }
  }

  async getOpenAIBrainText(): Promise<string> {
    const txtFile = await getLocalObjectFromURI(this.config.openai.brainTxtUrl, ".txt");
    return (await fs.promises.readFile(txtFile, "utf8")).toString().replace(/\r\n/g, "\n");
  }

  async invokeTrain(body: ResponseBody) {
    if (this.config.trainingSessionId) {
      console.debug(TAG, `Training invoked on sessionId ${this.config.trainingSessionId}`);

      const trainingSession = await IOManager.getSession(this.config.trainingSessionId);
      this.processInput(
        {
          event: { name: "training", parameters: { queryText: body.queryResult.queryText } },
        },
        trainingSession,
      );
    }
  }

  /**
   * Parse the DialogFlow body and decide what to do
   */
  async dfBodyParser(body: ResponseBody, session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    // The parameters coming from Dialogflow when running without the fulfillment server
    // are in a Struct (.fields) that needs decoding
    body.queryResult.parameters = this.decodeIfStruct(body.queryResult.parameters);

    // If we have an "action", call the package with the specified name
    if (body.queryResult.action) {
      console.debug(TAG, `Resolving action: ${body.queryResult.action}`);
      return this.actionResolver(body.queryResult.action, body, session, bag);
    }

    // Otherwise, check if at least an intent is match and direct return that fulfillment
    if (body.queryResult.intent) {
      console.debug(TAG, "Using body.queryResult object (matched from intent)");

      if (body.queryResult.intent.isFallback) {
        this.invokeTrain(body);
      }
      return {
        text: body.queryResult.fulfillmentText,
      };
    }

    return null;
  }

  async dfRequest(queryInput: IQueryInput, session: Session, bag?: IOManager.IOBag): Promise<IDetectIntentResponse> {
    if (queryInput.text) {
      queryInput.text.text = await translator().translate(
        queryInput.text.text,
        this.config.dialogflow.language,
        session.getTranslateFrom(),
      );
    }

    const sessionPath = this.getDFSessionPath(session);
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
  async commandRequest(command: InputParams["command"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "command request:", command);

    const commandExecutor = this.getCommandExecutor(command, session);
    try {
      return commandExecutor(session, bag);
    } catch (err) {
      return { payload: { error: err } };
    }
  }

  /**
   * Make a text request to DialogFlow and let the flow begin
   */
  async textRequestDF(text: InputParams["text"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "[df] text request:", text);

    const queryInput: IQueryInput = { text: { text } };
    queryInput.text.languageCode = this.config.dialogflow.language;

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body as ResponseBody, session, bag);
  }

  /**
   * Make a text request to OpenAI
   */
  async textRequestOpenAI(text: InputParams["text"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "[openai] text request:", text);

    const now = Math.floor(Date.now() / 1000);
    if ((session.openaiLastInteraction ?? 0) + this.config.openai.interactionTTL < now) {
      console.log(TAG, "resetting openaiChatLog");
      session.openaiChatLog = "";
    }

    const who = session.getName();

    const [brain, textTr] = await Promise.all([
      this.getOpenAIBrainText(),
      translator().translate(text, "en", session.getTranslateFrom()),
    ]);

    const brainHeader = `This is a chat between ${who} and an AI called ${this.config.aiName}\n###`;
    const brainModified = brain;
    const chatLog = (session.openaiChatLog ?? "") + `\n${who}: ${textTr.trim()}\n${this.config.aiName}: `;

    console.log(TAG, `chatLog`, chatLog);

    const prompt = brainHeader + "\n" + brainModified + "\n###\n" + chatLog;
    const params = {
      prompt: prompt,
      stop: [`${who}:`],
      temperature: 0.9,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0.6,
      best_of: 1,
      max_tokens: 100,
      n: 1,
    };

    const url = `https://api.openai.com/v1/engines/${this.config.openai.engine}/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.openai.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(params),
    });

    fs.writeFileSync(
      "openai-curl.txt",
      `curl -X POST ${url} -H "authorization: Bearer ${
        this.config.openai.token
      }" -H "content-type: application/json" -d "${JSON.stringify(params)}"`,
    );

    const json = await response.json();
    console.log(TAG, "response", json);

    const answer = json.choices[0].text.trim();

    if (answer) {
      session.openaiLastInteraction = now;
      session.openaiChatLog = chatLog + answer;
      session.save();

      return {
        text: answer,
        payload: { translateFrom: this.config.openai.language },
      };
    }

    return {
      text: "[empty_openai_text]",
    };
  }

  /**
   * Make an event request to DialogFlow and let the flow begin
   */
  async eventRequestDF(event: InputParams["event"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "[df] event request:", event);

    const queryInput: IQueryInput = { event: {} };

    if (typeof event === "string") {
      queryInput.event.name = event;
    } else {
      queryInput.event.name = event.name;
      queryInput.event.parameters = event.parameters ? struct.encode(event.parameters) : {};
    }
    queryInput.event.languageCode = this.config.dialogflow.language;

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body as ResponseBody, session, bag);
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: Session) {
    console.info(TAG, "processInput", { params, session });

    if (session.repeatModeSessions?.length > 0 && params.text) {
      console.info(TAG, "using repeatModeSessions", session.repeatModeSessions);
      return Promise.all(
        session.repeatModeSessions.map(async (e) => {
          const fulfillment = await this.fulfillmentTransformerForSession({ text: params.text }, e);
          return IOManager.output(fulfillment, e, params.bag);
        }),
      );
    }

    // IOManager.writeLogForSession(params, session);

    let fulfillment: any = null;
    if (params.text) {
      fulfillment = await this.textRequestDF(params.text, session, params.bag);
    } else if (params.event) {
      fulfillment = await this.eventRequestDF(params.event, session, params.bag);
    } else if (params.audio) {
      const text = await speechRecognizer().recognizeFile(params.audio, session.getTranslateFrom());
      fulfillment = await this.textRequestDF(text, session, params.bag);
    } else if (params.command) {
      fulfillment = await this.commandRequest(params.command, session, params.bag);
    } else if (params.repeatText) {
      fulfillment = { text: params.repeatText };
    } else {
      console.warn("Neither { text, event, command, repeatText, audio } in params are not null");
    }

    fulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);
    return IOManager.output(fulfillment, session, params.bag);
  }
}

let _instance: AI;
export default (): AI => {
  _instance = _instance || new AI(config());
  return _instance;
};
