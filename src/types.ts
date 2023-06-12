import type { Document } from "mongoose";
import type { IODriver, IOBag, Authorizations } from "./stdlib/iomanager";
import { IDetectIntentResponse } from "./stdlib/ai/dialogflow";

export type Language = string;
export type Locale = string;
export type Gender = string;

export type InputSource = "text" | "event" | "command" | "repeat" | "unknown";

export interface Fulfillment {
  text?: string | null;
  audio?: string;
  video?: string;
  image?: string;
  document?: string;
  caption?: string;
  error?: unknown | CustomError;
  data?: string;
  outputContexts?: Array<Record<string, any>>;
  options?: {
    language?: Language;
    translateTo?: Language;
    translateFrom?: Language;
    translatePolicy?: "always" | "when_necessary" | "never";
    includeVoice?: boolean;
  };
  analytics: {
    engine: "dialogflow" | "openai" | "commander" | "repeater" | "action";
    sessionId?: string;
  };
  runtime?: {
    finalizerUid?: string;
    finalizedAt?: number;
  };
}

export type AIActionArgs = {
  inputParams: InputParams;
  session: Session;
  dialogFlowOutputParams: IDetectIntentResponse | null;
};

export type AIAction = (args: AIActionArgs) => Promise<Fulfillment> | Fulfillment;

export type CustomError =
  | Error
  | unknown
  | {
      message?: string;
      data?: Record<string, any>;
    };

export interface InputParams {
  text?: string;
  event?:
    | string
    | {
        name: string;
        parameters?: Record<string, string>;
      };
  command?: string;
  repeatText?: string;
  bag?: any;
}
export interface IOQueue extends Document {
  id: string;
  fulfillment: Fulfillment;
  session: Session;
  bag?: any;
}

export interface Scheduler extends Document {
  session: Session;
  managerUid: string;
  programName: string;
  programArgs: any;
  yearly?: string; // set "dayofyear hour:minute"
  monthly?: string; // set "dayofmonth hour:minute"
  weekly?: string; // set "dayofweek hour:minute"
  daily?: string; // set "hour:minute"
  hourly?: string; // set minute
  onTick?: boolean; // every second
  onDate?: string; // on a date
  onBoot?: boolean;
  onDateISOString?: string;
  deleteAfterRun?: boolean;
}

export interface Interaction extends Document {
  id: string;
  managerUid: string;
  session: Session;
  reducedLongTermMemory: LongTermMemory;
  createdAt: Date;
  input: InputParams;
  fulfillment: Fulfillment;
  source: string;
}

export interface LongTermMemory extends Document {
  id: string;
  managerUid: string;
  session: Session;
  text: string;
  createdAt: Date;
  type: string;
  forDate: Date;
}

export interface Session extends Document {
  id: string;
  uid: string;
  ioDriver: IODriver;
  ioId: string;
  ioData?: Record<string, any>;
  name?: string;
  timeZone?: string;
  translateFrom: Language;
  translateTo: Language;
  authorizations: Authorizations[];
  fallbackSession: Session | undefined;
  redirectSessions: Session[] | undefined;
  forwardSessions: Session[] | undefined;
  repeatModeSessions: Session[] | undefined;
  doNotDisturb?: boolean;
}
