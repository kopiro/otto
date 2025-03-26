import { TIOChannel } from "./data/io-channel";
import { Input, Output } from "./types";

export type AIRuntimeFunctionArguments<TParams> = {
  input: Input;
  ioChannel: TIOChannel;
  parameters: TParams;
};

export type AIRuntimeFunction<T> = (args: AIRuntimeFunctionArguments<T>) => Promise<Output> | Output;
