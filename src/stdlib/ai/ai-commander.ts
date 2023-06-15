import { AIManager } from "./ai-manager";
import { Authorizations, Fulfillment, InputParams } from "../../types";
import { IOManager } from "../iomanager";
import { throwIfMissingAuthorizations } from "../../helpers";
import { Session, TSession } from "../../data/session";

type CommandFunction = (args: RegExpMatchArray, session: TSession) => Promise<Fulfillment>;

export class AICommander {
  private static instance: AICommander;
  static getInstance(): AICommander {
    if (!AICommander.instance) {
      AICommander.instance = new AICommander();
    }
    return AICommander.instance;
  }

  public readonly commandMapping: Array<{
    matcher: RegExp;
    name: string;
    executor: CommandFunction;
    description: string;
    authorizations: Authorizations[];
  }> = [
    {
      matcher: /^\/start/,
      name: "start",
      executor: this.start,
      description: "Start the bot",
      authorizations: [],
    },
    {
      matcher: /^\/whoami/,
      name: "whoami",
      executor: this.whoami,
      description: "Get your session",
      authorizations: [],
    },
    {
      matcher: /^\/IOManagertext ([^\s]+) (.+)/,
      name: "outputtext",
      executor: this.commandOutputText,
      description: "[sessionid] [text] - Send a text message to a specific session",
      authorizations: ["command"],
    },
    {
      matcher: /^\/input ([^\s]+) (.+)/,
      name: "input",
      executor: this.input,
      description: "[sessionid] [params_json] - Process an input param for a specific session",
      authorizations: ["command"],
    },
    {
      matcher: /^\/appstop/,
      name: "appstop",
      executor: this.appStop,
      description: "/appstop - Cause the application to crash",
      authorizations: ["command"],
    },
  ];

  private async notFound(): Promise<Fulfillment> {
    return { text: "Command not found", analytics: { engine: "commander" } };
  }

  private async appStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { text: "Scheduled shutdown in 5 seconds", analytics: { engine: "commander" } };
  }

  private async start(_: RegExpMatchArray, session: TSession): Promise<Fulfillment> {
    const fulfillment = await AIManager.getInstance().getFullfilmentForInput({ event: "welcome" }, session);
    if (fulfillment !== null) return fulfillment;
    return { text: "Welcome!", analytics: { engine: "commander" } };
  }

  private async whoami(_: RegExpMatchArray, session: TSession): Promise<Fulfillment> {
    return { data: JSON.stringify(session, null, 2), analytics: { engine: "commander" } };
  }

  private async input([, cmdSessionId, paramsStr]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await Session.findById(cmdSessionId);
    if (!cmdSession) throw new Error(`Session ${cmdSessionId} not found`);

    const params = JSON.parse(paramsStr);
    const result = await IOManager.getInstance().processInput(params, cmdSession);
    return { data: JSON.stringify(result, null, 2), analytics: { engine: "commander" } };
  }

  private async commandOutputText([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await Session.findById(cmdSessionId);
    if (!cmdSession) throw new Error(`Session ${cmdSessionId} not found`);

    const result = await IOManager.getInstance().output(
      { text: cmdText, analytics: { engine: "commander" } },
      cmdSession,
      {},
    );
    return { data: JSON.stringify(result, null, 2), analytics: { engine: "commander" } };
  }

  private getCommandExecutor(text: string): (session: TSession) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        return async (session: TSession) => {
          try {
            throwIfMissingAuthorizations(session.authorizations, cmd.authorizations);
            const result = await cmd.executor.call(this, matches, session);
            return result;
          } catch (err) {
            return {
              error: { message: (err as Error).message, error: err as Error },
              analytics: { engine: "commander" },
            };
          }
        };
      }
    }

    return () => this.notFound();
  }

  public async getFulfillmentForInput(params: InputParams, session: TSession): Promise<Fulfillment> {
    if (!params.command) throw new Error("Missing command");

    const executor = this.getCommandExecutor(params.command);
    return executor(session);
  }
}
