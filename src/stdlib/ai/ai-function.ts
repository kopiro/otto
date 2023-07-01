import { Fulfillment, AIRuntimeFunction, InputParams, Authorization } from "../../types";
import { functionsDir } from "../../paths";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { throwIfMissingAuthorizations } from "../../helpers";
import { Signale } from "signale";
import { TIOChannel } from "../../data/io-channel";
import { TPerson } from "../../data/person";

const TAG = "AIFunction";
const logger = new Signale({
  scope: TAG,
});

type FunctionDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
};

type FunctionRuntime = {
  default: AIRuntimeFunction<any>;
  authorizations?: Authorization[];
};

export class AIFunction {
  private readonly functionDefinitions: FunctionDefinition[];

  private static instance: AIFunction;
  static getInstance(): AIFunction {
    if (!AIFunction.instance) {
      AIFunction.instance = new AIFunction();
    }
    return AIFunction.instance;
  }

  constructor() {
    this.functionDefinitions = readdirSync(functionsDir).map((dir) => {
      const packageJson = path.join(functionsDir, dir, "package.json");
      const definition = JSON.parse(readFileSync(packageJson, "utf-8"));
      return {
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
        ...definition,
        name: dir,
      } as FunctionDefinition;
    });
  }

  getFunctionDefinitions() {
    return this.functionDefinitions;
  }

  async call(
    functionName: string,
    functionParameters: object,
    inputParams: InputParams,
    ioChannel: TIOChannel,
    person: TPerson,
  ): Promise<Fulfillment> {
    logger.info(`Calling AI function <${functionName}> with arguments <${JSON.stringify(functionParameters)}>`);

    if (functionName.includes("..") || functionName.includes("..")) {
      throw new Error(`Unsafe action name <${functionName}>`);
    }

    const pkgRuntime = (await import("../../functions/" + functionName)) as FunctionRuntime | null;
    if (!pkgRuntime) {
      throw new Error(`Invalid function name <${functionName}>`);
    }

    throwIfMissingAuthorizations(person.authorizations, pkgRuntime.authorizations);

    const result = await pkgRuntime.default({
      inputParams,
      parameters: functionParameters,
      ioChannel,
    });

    return result;
  }
}
