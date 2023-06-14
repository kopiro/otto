import * as IOManager from "../iomanager";
import { Fulfillment, AIRuntimeFunction, Session, InputParams } from "../../types";
import { functionsDir } from "../../paths";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { throwIfMissingAuthorizations } from "../../helpers";
import { Signale } from "signale";

const TAG = "AIFunction";
const console = new Signale({
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
  authorizations?: IOManager.Authorizations[];
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
    session: Session,
  ): Promise<Fulfillment> {
    try {
      console.info(`Calling AI function <${functionName}> with arguments <${JSON.stringify(functionParameters)}>`);

      if (functionName.includes("..") || functionName.includes("..")) {
        throw new Error(`Unsafe action name <${functionName}>`);
      }

      const pkgRuntime = (await import(path.join(functionsDir, functionName))) as FunctionRuntime | null;
      if (!pkgRuntime) {
        throw new Error(`Invalid function name <${functionName}>`);
      }

      throwIfMissingAuthorizations(session.authorizations, pkgRuntime.authorizations);

      const result = await pkgRuntime.default({
        inputParams,
        parameters: functionParameters,
        session,
      });

      return result;
    } catch (error) {
      console.error("Error while executing action", error);

      return {
        error: {
          message: error.message,
          error: error,
        },
        analytics: {
          engine: "action",
        },
      };
    }
  }
}
