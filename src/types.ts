import { Document } from "mongoose";
import { IODriver, IOBag, Authorizations } from "./stdlib/iomanager";

export type Language = string;
export type Locale = string;
export type Gender = string;

export type AIAction = (
  body: Record<string, any>,
  session: Session,
  bag: IOBag,
) => Promise<Fulfillment | string> | IterableIterator<Fulfillment | string> | Fulfillment | string;

export interface CustomError {
  message?: string;
  data?: Record<string, any>;
}

export interface BufferWithExtension {
  buffer: Uint8Array | string | { toString: (encoding?: string) => string };
  extension: string;
}

export interface Fulfillment {
  fulfillmentText?: string;
  outputContexts?: Array<{}>;
  followupEventInput?: {
    name: string;
    data?: Record<string, string>;
  };
  payload?: {
    feedback?: boolean;
    welcome?: boolean;
    language?: Language;
    transformerUid?: string;
    transformedAt?: number;
    translateTo?: Language;
    didTranslatedTo?: Language;
    translateFrom?: Language;
    didTranslatedFrom?: Language;
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
  audio?: BufferWithExtension;
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
  pipe: {
    nextWithVoice?: boolean;
    includeVoice?: boolean;
  };
  fallbackSession: Session | undefined;
  redirectSessions: Session[] | undefined;
  forwardSessions: Session[] | undefined;
  repeatModeSessions: Session[] | undefined;
  saveServerSettings: (data: {}) => Promise<boolean>;
  savePipe: (data: {}) => Promise<boolean>;
  getTranslateFrom: () => Language;
  getTranslateTo: () => Language;
}
