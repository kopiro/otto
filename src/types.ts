import type { Document } from "mongoose";
import type { IODriver, Authorizations, IOBag } from "./stdlib/iomanager";

export type Language = string;
export type Locale = string;
export type Gender = string;

export type InputSource = "text" | "event" | "command" | "unknown";

export type Fulfillment = {
  text?: string;
  audio?: string;
  voice?: string;
  video?: string;
  image?: string;
  document?: string;
  caption?: string;
  functionResult?: string;
  error?: CustomError;
  data?: string;
  options?: {
    language?: Language;
    translateTo?: Language;
    translateFrom?: Language;
    translatePolicy?: "always" | "when_necessary" | "never";
    includeVoice?: boolean;
  };
  analytics: {
    engine?: "dialogflow" | "openai" | "commander" | "repeater" | "action";
    sessionId?: string;
  };
  runtime?: {
    finalizerUid?: string;
    finalizedAt?: number;
  };
};

export type AIRuntimeFunctionArguments<T> = {
  inputParams: InputParams;
  session: Session;
  parameters: T;
};

export type AIRuntimeFunction<T> = (args: AIRuntimeFunctionArguments<T>) => Promise<Fulfillment> | Fulfillment;

export type CustomError = {
  message: string;
  error?: Error;
};

export type InputParams = {
  text?: string;
  event?:
    | string
    | {
        name: string;
        parameters?: Record<string, string>;
      };
  command?: string;
  bag?: IOBag;
};
export interface IOQueue extends Document {
  id: string;
  fulfillment: Fulfillment;
  session: Session;
  bag?: IOBag;
}

export interface Scheduler extends Document {
  id: string;
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
  reducedAt: Date;
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
  translateFrom?: Language;
  translateTo?: Language;
  authorizations?: Authorizations[];
  fallbackSession?: Session;
  redirectSessions?: Session[];
  forwardSessions?: Session[];
  repeatModeSessions?: Session[];
  doNotDisturb?: boolean;
}
