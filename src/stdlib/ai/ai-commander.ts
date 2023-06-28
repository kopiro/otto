import { AIManager } from "./ai-manager";
import { Authorizations, Fulfillment, InputParams } from "../../types";
import { IOManager } from "../io-manager";
import { throwIfMissingAuthorizations } from "../../helpers";
import { IOChannel, TIOChannel } from "../../data/io-channel";
import { Person, TPerson } from "../../data/person";

type CommandFunction = (args: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson | null) => Promise<Fulfillment>;

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
      description: "Get your ioChannel",
      authorizations: [],
    },
    {
      matcher: /^\/outputtext ([^\s]+) (.+)/,
      name: "outputtext",
      executor: this.commandOutputText,
      description: "[ioChannel] [text] - Send a text message to a specific ioChannel",
      authorizations: ["command"],
    },
    {
      matcher: /^\/input ([^\s]+) ([^\s]+) (.+)/,
      name: "input",
      executor: this.input,
      description: "[ioChannel] [person] [params_json] - Process an input param for a specific ioChannel and person",
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
    return { text: "Command not found" };
  }

  private async appStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { text: "Scheduled shutdown in 5 seconds" };
  }

  private async start(_: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson | null): Promise<Fulfillment> {
    const fulfillment = await AIManager.getInstance().getFullfilmentForInput({ text: "Hello!" }, ioChannel, person);
    return fulfillment;
  }

  private async whoami(_: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson | null): Promise<Fulfillment> {
    return { data: JSON.stringify({ ioChannel, person }, null, 2) };
  }

  private async input([, ioChannelId, personId, paramsStr]: RegExpMatchArray): Promise<Fulfillment> {
    const ioChannel = await IOChannel.findById(ioChannelId);
    if (!ioChannel) throw new Error(`Session ${ioChannelId} not found`);

    const person = await Person.findById(personId);
    if (!person) throw new Error(`Person ${personId} not found`);

    const params = JSON.parse(paramsStr);
    const result = await IOManager.getInstance().processInput(params, ioChannel, person, null);
    return { data: JSON.stringify(result, null, 2) };
  }

  private async commandOutputText([, ioChannelId, personId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const ioChannel = await IOChannel.findById(ioChannelId);
    if (!ioChannel) throw new Error(`Session ${ioChannelId} not found`);

    const person = await Person.findById(personId);
    if (!person) throw new Error(`Person ${personId} not found`);

    const result = await IOManager.getInstance().output({ text: cmdText }, ioChannel, person, {});
    return { data: JSON.stringify(result, null, 2) };
  }

  private getCommandExecutor(text: string): (ioChannel: TIOChannel, person: TPerson | null) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        return async (ioChannel: TIOChannel, person: TPerson | null) => {
          throwIfMissingAuthorizations(person?.authorizations, cmd.authorizations);
          const result = await cmd.executor.call(this, matches, ioChannel, person);
          return result;
        };
      }
    }

    return () => this.notFound();
  }

  public async getFulfillmentForInput(
    params: InputParams,
    ioChannel: TIOChannel,
    person: TPerson | null,
  ): Promise<Fulfillment> {
    if (params.command) {
      const executor = this.getCommandExecutor(params.command);
      return executor(ioChannel, person);
    }
    throw new Error("Unable to process request");
  }
}
