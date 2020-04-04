import { EventEmitter } from "events";
import { Document } from "mongoose";

export type Language = string;
export type Locale = string;
export type Gender = string;

export type AIAction = (
  body: Record<string, any>,
  session: Session,
) => Promise<Fulfillment | string> | IterableIterator<Fulfillment | string> | Fulfillment | string;

export interface CustomError {
  message?: string;
  data?: Record<string, any>;
}

export interface BufferWithExtension {
  buffer: Uint8Array | string | { toString: () => string };
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
    language?: Language;
    transformerUid?: string;
    transformedAt?: number;
    translatedTo?: Language;
    error?: CustomError;
    handledByGenerator?: boolean;
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
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOQueue extends Document {
  id: string;
  fulfillment: Fulfillment;
  session: Session;
}

export interface Session extends Document {
  id: string;
  ioDriver: string;
  ioId: string;
  ioData: {};
  serverSettings: {};
  settings: {};
  translateFrom: Language;
  translateTo: Language;
  alias: string | null;
  isAdmin: boolean;
  pipe: {};
  fallbackSession: Session | undefined;
  redirectSession: Session | undefined;
  forwardSession: Session | undefined;
  repeatModeSession: Session | undefined;
  saveServerSettings: (data: {}) => Promise<boolean>;
  savePipe: (data: {}) => Promise<boolean>;
  getTranslateFrom: () => Language;
  getTranslateTo: () => Language;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IODriverModule {
  start: () => void;
  output: (fulfillment: Fulfillment, session: Session) => void;
  emitter: EventEmitter;
  onlyClientMode: boolean;
  onlyServerMode: boolean;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOListenerModule {
  start: () => void;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOAccessoryModule {
  start: () => void;
  output: (fulfillment: Fulfillment, session: Session) => void;
}
