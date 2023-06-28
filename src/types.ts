import { TIOChannel } from "./data/io-channel";
import type { IOBag } from "./stdlib/io-manager";

export type Language = string;
export type Gender = "Male" | "Female";

export type Authorizations = "admin" | "camera" | "command";

export type Fulfillment = {
  text?: string;
  voice?: string;
  audio?: string;
  video?: string;
  image?: string;
  document?: string;
  functionResult?: string;
  error?: CustomError;
  data?: string;
  options?: {
    language?: Language;
    translateTo?: Language;
    translatePolicy?: "always" | "when_necessary" | "never";
    includeVoice?: boolean;
  };
  runtime?: {
    finalizerUid?: string;
    finalizedAt?: number;
  };
};

export type AIRuntimeFunctionArguments<TParams> = {
  inputParams: InputParams;
  ioChannel: TIOChannel;
  parameters: TParams;
};

export type AIRuntimeFunction<T> = (args: AIRuntimeFunctionArguments<T>) => Promise<Fulfillment> | Fulfillment;

export type CustomError = {
  message: string;
};

export type InputContext = Record<string, string>;

export type InputParams = {
  text?: string;
  image?: string;
  command?: string;
  context?: InputContext;
  bag?: IOBag;
};
