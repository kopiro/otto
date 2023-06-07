import type { Document } from "mongoose";
import type { IDetectIntentResponse } from "./stdlib/ai";
import type { IODriver, IOBag, Authorizations } from "./stdlib/iomanager";
import { ChatCompletionRequestMessageRoleEnum } from "openai";

export type Language = string;
export type Locale = string;
export type Gender = string;

export type AIAction = (
  body: IDetectIntentResponse,
  session: Session,
  bag: IOBag,
) => Promise<Fulfillment> | IterableIterator<Fulfillment> | Fulfillment;

export type CustomError =
  | Error
  | unknown
  | {
      message?: string;
      data?: Record<string, any>;
    };

export type FullfillmentStringKeysTypes = "audio" | "video" | "image" | "caption" | "document";
export const FullfillmentStringKeys: FullfillmentStringKeysTypes[] = ["audio", "video", "image", "caption", "document"];

export interface Fulfillment {
  text?: string | null;
  audio?: string;
  video?: string;
  image?: string;
  document?: string;
  caption?: string;
  error?: unknown | CustomError;
  data?: string;
  poll?: {
    question: string;
    choices: string[];
    is_anonymous?: boolean;
    type?: "regular" | "quiz";
    allows_multiple_answers?: boolean;
    correct_option_id?: number;
    explanation?: string;
    close_date?: number;
    is_closed?: boolean;
  };
  outputContexts?: Array<Record<string, any>>;
  options?: {
    language?: Language;
    finalizerUid?: string;
    finalizedAt?: number;
    translateTo?: Language;
    translateFrom?: Language;
    handledByGenerator?: boolean;
    includeVoice?: boolean;
    sessionId?: string;
  };
}
export interface InputParams {
  text?: string;
  repeatText?: string;
  event?:
    | string
    | {
        name: string;
        parameters?: Record<string, string>;
      };
  audio?: string;
  command?: string;
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
  session: Session;
  reducedLongTermMemory: LongTermMemory;
  createdAt: Date;
  input: InputParams;
  fulfillment: Fulfillment;
  source: string;
}

export interface LongTermMemory extends Document {
  id: string;
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
  ioData: Record<string, any>;
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
