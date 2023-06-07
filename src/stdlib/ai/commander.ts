import ai from ".";
import { Interaction } from "../../data";
import { Fulfillment, Session } from "../../types";
import { Authorizations } from "../iomanager";
import { IOBag } from "../iomanager";
import { output } from "../iomanager";
import { getSession } from "../iomanager";

type CommandFunction = (args: RegExpMatchArray, session: Session, bag: IOBag) => Promise<Fulfillment>;

class AICommander {
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
    return { text: "Command not found" };
  }

  private async appStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { text: "Scheduled shutdown in 5 seconds" };
  }

  private async start(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    const fulfillment = await ai().getFullfilmentForInput({ event: "welcome" }, session);
    if (fulfillment !== null) return fulfillment;
    return { text: "Welcome!" };
  }

  private async whoami(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    return { data: JSON.stringify(session, null, 2) };
  }

  private async input([, cmdSessionId, paramsStr]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await getSession(cmdSessionId);
    const params = JSON.parse(paramsStr);
    const result = await ai().processInput(params, cmdSession);
    return { data: JSON.stringify(result, null, 2) };
  }

  private async commandOutputText([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await getSession(cmdSessionId);
    const result = await output({ text: cmdText }, cmdSession, {});
    return { data: JSON.stringify(result, null, 2) };
  }

  public getCommandExecutor(text: string, session: Session): (session: Session, bag: IOBag) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        if (
          (cmd.authorization && session.authorizations.includes(cmd.authorization)) ||
          session.authorizations.includes(Authorizations.ADMIN) ||
          cmd.authorization == null
        ) {
          return async (session: Session, bag: IOBag) => {
            try {
              const result = await cmd.executor.call(this, matches, session, bag);
              return result;
            } catch (err) {
              return { error: { message: String(err), data: err } };
            }
          };
        } else {
          return async () => ({ text: "User not authorized" });
        }
      }
    }

    return () => this.notFound();
  }
}

let _instance: AICommander;
export default (): AICommander => {
  _instance = _instance || new AICommander();
  return _instance;
};
