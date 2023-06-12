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
   * Transform an error into a fulfillment
   */
  errorToFulfillment(error: CustomError): Fulfillment {
    const fulfillment: Fulfillment = {
      analytics: {
        engine: "action",
      },
    };
    fulfillment.error = error;
    return fulfillment;
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  async resolveAction(
    actionName: string,
    inputParams: InputParams,
    session: Session,
    dialogFlowOutputParams: IDetectIntentResponse | null,
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
        session,
      });

      return actionResult as Fulfillment;
    } catch (err) {
      console.error("error while executing action", err);
      return this.errorToFulfillment(err);
    }
  }
}
