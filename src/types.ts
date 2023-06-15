import { TSession } from "./data/session";
import type { IOBag } from "./stdlib/iomanager";

export type Language = string;
export type Gender = "Male" | "Female";

export type Authorizations = "admin" | "camera" | "command";

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
    translatePolicy?: "always" | "when_necessary" | "never";
    includeVoice?: boolean;
  };
  analytics: {
    engine?: "dialogflow" | "openai" | "commander" | "repeater" | "action";
  };
  runtime?: {
    finalizerUid?: string;
    finalizedAt?: number;
  };
};

export type AIRuntimeFunctionArguments<TParams> = {
  inputParams: InputParams;
  session: TSession;
  parameters: TParams;
};

export type AIRuntimeFunction<T> = (args: AIRuntimeFunctionArguments<T>) => Promise<Fulfillment> | Fulfillment;

export type CustomError = {
  message: string;
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
