import { TIOChannel } from "./data/io-channel";
import type { IOBag } from "./stdlib/io-manager";

export type Language = string;
export type Gender = "male" | "female";

export enum Authorization {
  ADMIN = "admin",
  CAMERA = "camera",
  COMMAND = "command",
  MESSAGE = "message",
}

export type Fulfillment = {
  text?: string;
  voice?: string;
  audio?: string;
  video?: string;
  image?: string;
  document?: string;
  error?: IErrorWithData;
  data?: string;
  functionResult?: string;
};

export type AIRuntimeFunctionArguments<TParams> = {
  inputParams: InputParams;
  ioChannel: TIOChannel;
  parameters: TParams;
};

export type AIRuntimeFunction<T> = (args: AIRuntimeFunctionArguments<T>) => Promise<Fulfillment> | Fulfillment;

export type IErrorWithData = {
  message: string;
  data?: string;
};

export type InputContext = Record<string, string>;

type InputParamsOption = {
  role?: "system" | "user" | "assistant";
  context?: InputContext;
  bag?: IOBag;
};

// text: "Hello" OR command: "Hello" - and then merge with InputParamsOption
export type InputParams = ({ text: string } & InputParamsOption) | ({ command: string } & InputParamsOption);
