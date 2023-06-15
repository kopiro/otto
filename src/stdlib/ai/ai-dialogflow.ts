import dialogflow, { protos, SessionsClient, IntentsClient } from "@google-cloud/dialogflow";
import config from "../../config";
import { Fulfillment, InputParams } from "../../types";
import { struct } from "pb-util";
import { Translator } from "../translator";
import { AIOpenAI } from "./ai-openai";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { AIFunction } from "./ai-function";
import { IOBag } from "../iomanager";
import { TSession } from "../../data/session";
import { Interaction } from "../../data/interaction";

export type IDetectIntentResponse = protos.google.cloud.dialogflow.v2.IDetectIntentResponse;
export type IQueryInput = protos.google.cloud.dialogflow.v2.IQueryInput;

export type FullfillmentStringKeysTypes = "audio" | "video" | "image" | "caption" | "document";
const FullfillmentStringKeys: FullfillmentStringKeysTypes[] = ["audio", "video", "image", "caption", "document"];

type DialogFlowConfig = {
  projectId: string;
  environment?: string;
  language: string;
};

export class AIDialogFlow {
  private static instance: AIDialogFlow;
  static getInstance() {
    if (!AIDialogFlow.instance) {
      AIDialogFlow.instance = new AIDialogFlow(config().dialogflow);
    }
    return AIDialogFlow.instance;
  }

  dfSessionClient: SessionsClient = new dialogflow.SessionsClient();
  dfIntentsClient: IntentsClient = new dialogflow.IntentsClient();
  dfIntentAgentPath: string;

  constructor(private conf: DialogFlowConfig) {
    this.dfIntentAgentPath = this.dfIntentsClient.projectAgentPath(this.conf.projectId);
  }

  private getSessionPath(session: TSession) {
    if (!this.conf.environment) {
      return this.dfSessionClient.projectAgentSessionPath(this.conf.projectId, session.id);
    }

    return this.dfSessionClient.projectAgentEnvironmentUserSessionPath(
      this.conf.projectId,
      this.conf.environment,
      "-",
      session.id,
    );
  }

  private extractMessages(fulfillmentMessages: protos.google.cloud.dialogflow.v2.Intent.IMessage[], key: string) {
    return fulfillmentMessages?.find((m) => m?.payload?.fields?.[key] !== undefined)?.payload?.fields?.[key]
      .stringValue;
  }

  private async request(queryInput: IQueryInput, session: TSession, bag: IOBag) {
    if (queryInput.text?.text) {
      queryInput.text.text = await Translator.getInstance().translate(queryInput.text.text, this.conf.language);
    }

    const sessionPath = this.getSessionPath(session);
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
   * Parse the DialogFlow body and decide what to do
   */
  private async bodyParser(
    params: InputParams,
    body: IDetectIntentResponse,
    session: TSession,
  ): Promise<Fulfillment | null> {
    const { fulfillmentText, fulfillmentMessages, action, queryText, parameters } = body.queryResult || {};

    // If we have an "action", call the package with the specified name
    if (action) {
      const actionParameters = struct.decode(body.queryResult.parameters.fields);
      return AIFunction.getInstance().call(action, actionParameters, params, session);
    }

    // Deprecate this shit
    let prompt = fulfillmentMessages?.find((m) => m?.payload?.fields?.openai_prompt?.stringValue)?.payload?.fields
      ?.openai_prompt?.stringValue;
    if (prompt) {
      for (const [key, value] of Object.entries(parameters?.fields ?? [])) {
        prompt = prompt.replace(new RegExp(`{${key}}`, "g"), value.stringValue || "UNKNOWN");
      }

      return AIOpenAI.getInstance().getFulfillmentForInput(
        { text: prompt },
        session,
        queryText ? ChatCompletionRequestMessageRoleEnum.User : ChatCompletionRequestMessageRoleEnum.System,
      );
    }

    const spreadFulfillment: Fulfillment = {
      analytics: {
        engine: "dialogflow",
      },
    };
    if (fulfillmentText) {
      spreadFulfillment.text = fulfillmentText;
    }
    for (const key of FullfillmentStringKeys) {
      const value = this.extractMessages(fulfillmentMessages || [], key);
      if (value) spreadFulfillment[key] = value;
    }
    return spreadFulfillment;
  }

  /**
   * @deprecated
   */
  async textRequest(params: InputParams, session: TSession): Promise<Fulfillment | null> {
    const { text } = params;

    Interaction.createNew(session, {
      input: { text },
    });

    const queryInput: IQueryInput = { text: { text } };
    queryInput.text.languageCode = this.conf.language;

    const body = await this.request(queryInput, session, params.bag);
    return this.bodyParser(params, body, session);
  }

  async eventRequest(params: InputParams, session: TSession): Promise<Fulfillment | null> {
    const { event } = params;
    const queryInput: IQueryInput = { event: {} };

    if (typeof event === "string") {
      queryInput.event.name = event;
    } else {
      queryInput.event.name = event.name;
      queryInput.event.parameters = event.parameters ? struct.encode(event.parameters) : {};
    }
    queryInput.event.languageCode = this.conf.language;

    Interaction.createNew(session, {
      input: { event },
    });

    const body = await this.request(queryInput, session, params.bag);
    return this.bodyParser(params, body, session);
  }

  async getFulfillmentForInput(params: InputParams, session: TSession) {
    if (params.text) {
      return this.textRequest(params, session);
    }
    if (params.event) {
      return this.eventRequest(params, session);
    }
    throw new Error("Invalid input params");
  }
}
