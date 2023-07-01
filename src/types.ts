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

export type InputContext = {
  current_datetime_utc?: string;
  user_calendar?: string;
  user_timezone?: string;
  user_location?: string;
};

export type InputParams = {
  text?: string;
  role?: "system" | "user" | "assistant";
  image?: string;
  command?: string;
  context?: InputContext;
  bag?: IOBag;
};
