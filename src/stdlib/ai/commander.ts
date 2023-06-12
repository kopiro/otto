import { AIDirector } from "./director";
import { Fulfillment, InputParams, Session } from "../../types";
import { Authorizations } from "../iomanager";
import { IOBag } from "../iomanager";
import { output } from "../iomanager";
import { getSession } from "../iomanager";

type CommandFunction = (args: RegExpMatchArray, session: Session, bag: IOBag) => Promise<Fulfillment>;

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
    authorization: Authorizations | null;
  }> = [
    {
      matcher: /^\/start/,
      name: "start",
      executor: this.start,
      description: "Start the bot",
      authorization: null,
    },
    {
      matcher: /^\/whoami/,
      name: "whoami",
      executor: this.whoami,
      description: "Get your session",
      authorization: null,
    },
    {
      matcher: /^\/outputtext ([^\s]+) (.+)/,
      name: "outputtext",
      executor: this.commandOutputText,
      description: "[sessionid] [text] - Send a text message to a specific session",
      authorization: Authorizations.COMMAND,
    },
    {
      matcher: /^\/input ([^\s]+) (.+)/,
      name: "input",
      executor: this.input,
      description: "[sessionid] [params_json] - Process an input param for a specific session",
      authorization: Authorizations.COMMAND,
    },
    {
      matcher: /^\/appstop/,
      name: "appstop",
      executor: this.appStop,
      description: "/appstop - Cause the application to crash",
      authorization: Authorizations.ADMIN,
    },
  ];

  private async notFound(): Promise<Fulfillment> {
    return { text: "Command not found", analytics: { engine: "commander" } };
  }

  private async appStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { text: "Scheduled shutdown in 5 seconds", analytics: { engine: "commander" } };
  }

  private async start(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    const fulfillment = await AIDirector.getInstance().getFullfilmentForInput({ event: "welcome" }, session);
    if (fulfillment !== null) return fulfillment;
    return { text: "Welcome!", analytics: { engine: "commander" } };
  }

  private async whoami(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    return { data: JSON.stringify(session, null, 2), analytics: { engine: "commander" } };
  }

  private async input([, cmdSessionId, paramsStr]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await getSession(cmdSessionId);
    const params = JSON.parse(paramsStr);
    const result = await AIDirector.getInstance().processInput(params, cmdSession);
    return { data: JSON.stringify(result, null, 2), analytics: { engine: "commander" } };
  }

  private async commandOutputText([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await getSession(cmdSessionId);
    const result = await output({ text: cmdText, analytics: { engine: "commander" } }, cmdSession, {});
    return { data: JSON.stringify(result, null, 2), analytics: { engine: "commander" } };
  }

  private getCommandExecutor(text: string, session: Session): (session: Session) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        if (
          (cmd.authorization && session.authorizations.includes(cmd.authorization)) ||
          session.authorizations.includes(Authorizations.ADMIN) ||
          cmd.authorization == null
        ) {
          return async (session: Session) => {
            try {
              const result = await cmd.executor.call(this, matches, session);
              return result;
            } catch (err) {
              return { error: { message: String(err), data: err } };
            }
          };
        } else {
          return async () => ({ text: "User not authorized", analytics: { engine: "commander" } });
        }
      }
    }

    return () => this.notFound();
  }

  public async getFulfillmentForInput(params: InputParams, session: Session): Promise<Fulfillment> {
    const executor = this.getCommandExecutor(params.command, session);
    return executor(session);
  }
}
