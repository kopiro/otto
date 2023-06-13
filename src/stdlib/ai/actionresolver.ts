import * as IOManager from "../iomanager";
import { Fulfillment, CustomError, AIAction, Session, InputParams } from "../../types";
import { IDetectIntentResponse } from "./dialogflow";

export class AIActionResolver {
  private static instance: AIActionResolver;
  static getInstance(): AIActionResolver {
    if (!AIActionResolver.instance) {
      AIActionResolver.instance = new AIActionResolver();
    }
    return AIActionResolver.instance;
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  async resolveAction(
    actionName: string,
    inputParams: InputParams,
    session: Session,
    dialogFlowOutputParams: IDetectIntentResponse | null,
    openaiOutputParams: any,
  ): Promise<Fulfillment> {
    console.info(`calling action <${actionName}>`);

    try {
      const [pkgName, pkgAction = "index"] = actionName.split(".");

      if (pkgName.includes("..") || pkgAction.includes("..")) {
        throw new Error(`Unsafe action name <${pkgName}.${pkgAction}>`);
      }

      const pkg = await import(`../../packages/${pkgName}/${pkgAction}`);
      if (!pkg) {
        throw new Error(`Invalid action name <${pkgName}.${actionName}>`);
      }

      const pkgAuthorizations = (pkg.authorizations || []) as IOManager.Authorizations[];
      const sessionAuthorizations = session.authorizations || [];
      for (const pkgAuth of pkgAuthorizations) {
        if (!sessionAuthorizations.includes(pkgAuth)) {
          throw new Error(`Missing ${pkgAuth} authorization for your session`);
        }
      }

      const pkgCallable = pkg.default as AIAction;
      const actionResult = await pkgCallable({
        inputParams,
        dialogFlowOutputParams,
        openaiOutputParams,
        session,
      });

      return actionResult;
    } catch (error) {
      console.error("Error while executing action", error);
      return {
        error,
        analytics: {
          engine: "action",
        },
      };
    }
  }
}
