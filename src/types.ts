import { Document } from "mongoose";
import { IODriver, IOBag, Authorizations } from "./stdlib/iomanager";

export type Language = string;
export type Locale = string;
export type Gender = string;

export type AIAction = (
  body?: Record<string, any>,
  session?: Session,
  bag?: IOBag,
) => Promise<Fulfillment> | IterableIterator<Fulfillment> | Fulfillment;

export interface CustomError {
  message?: string;
  data?: Record<string, any>;
}

export interface Fulfillment {
  text?: string;
  outputContexts?: Array<{}>;
  payload?: {
    data?: any;
    feedback?: boolean;
    welcome?: boolean;
    language?: Language;
    transformerUid?: string;
    transformedAt?: number;
    translateTo?: Language;
    translateFrom?: Language;
    error?: CustomError;
    handledByGenerator?: boolean;
    includeVoice?: boolean;
    url?: string;
    video?: {
      uri: string;
    };
    image?: {
      uri: string;
    };
    audio?: {
      uri: string;
    };
    document?: {
      uri: string;
    };
    telegram?: {
      game: string;
      sticker: string;
    };
  };
}
export interface InputParams {
  text?: string;
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

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOQueue extends Document {
  id: string;
  fulfillment: Fulfillment;
  session: Session;
  bag: any;
}

export interface Scheduler extends Document {
  session: Session;
  managerUid: string;
  programName: string;
  programArgs: any;
  yearly: string; // set "dayofyear hour:minute"
  monthly: string; // set "dayofmonth hour:minute"
  weekly: string; // set "dayofweek hour:minute"
  daily: string; // set "hour:minute"
  hourly: string; // set minute
  onTick: boolean; // every second
  onDate: string; // on a date
}

export interface Session extends Document {
  id: string;
  uid: string;
  ioDriver: IODriver;
  ioId: string;
  ioData: Record<string, any>;
  serverSettings: {};
  settings: {};
  translateFrom: Language;
  translateTo: Language;
  authorizations: Authorizations[];
  fallbackSession: Session | undefined;
  redirectSessions: Session[] | undefined;
  forwardSessions: Session[] | undefined;
  repeatModeSessions: Session[] | undefined;
  doNotDisturb: boolean;
  openaiChatLog?: string;
  openaiLastInteraction?: number;
  getTranslateFrom: () => Language;
  getTranslateTo: () => Language;
  getName(): () => string;
}
