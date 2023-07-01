import { AIManager } from "./ai-manager";
import { Authorization, Fulfillment, InputParams } from "../../types";
import { IOManager } from "../io-manager";
import { throwIfMissingAuthorizations } from "../../helpers";
import { IOChannel, TIOChannel } from "../../data/io-channel";
import { Person, TPerson } from "../../data/person";
import { Database } from "../database";

type CommandFunction = (args: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson) => Promise<Fulfillment>;

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
    authorizations: Authorization[];
  }> = [
    {
      matcher: /^\/start/,
      name: "start",
      executor: this.commandStart,
      description: "/start - Start the bot",
      authorizations: [],
    },
    {
      matcher: /^\/whoami/,
      name: "whoami",
      executor: this.commandWhoami,
      description: "/whoami - Get informations about you",
      authorizations: [],
    },
    {
      matcher: /^\/output_text ([^\s]+) (.+)/,
      name: "output_text",
      executor: this.commandOutputText,
      description: "/output_text [io_channel_id] [text] - Send a text message to a specific io_channel_id",
      authorizations: [Authorization.ADMIN],
    },
    {
      matcher: /^\/input ([^\s]+) ([^\s]+) (.+)/,
      name: "input",
      executor: this.commandInput,
      description:
        "/input [io_channel_id] [person] [params_json] - Process an input param for a specific io_channel_id and person",
      authorizations: [Authorization.ADMIN],
    },
    {
      matcher: /^\/admin_help/,
      name: "input",
      executor: this.commandAdminHelp,
      description: "/admin_help - Get list of all commands",
      authorizations: [Authorization.ADMIN],
    },
    {
      matcher: /^\/query_get ([^\s]+) (.+)/,
      name: "query_get",
      executor: this.commandQueryGet,
      description: "/query_get [table] [query_json] - Query a table with a specific query",
      authorizations: [Authorization.ADMIN],
    },
    {
      matcher: /^\/query_update ([^\s]+) (.+)/,
      name: "query_update",
      executor: this.commandQueryUpdate,
      description: "/query_update [table] [query_get_and_set_json] - Update a table with a specific query",
      authorizations: [Authorization.ADMIN],
    },
    {
      matcher: /^\/approve_person ([^\s]+)/,
      name: "approve",
      executor: this.commandApprovePerson,
      description: "/approve_person [person_id] - Set the minimum authorization for a person to message the bot",
      authorizations: [Authorization.ADMIN],
    },
    {
      matcher: /^\/app_stop/,
      name: "app_stop",
      executor: this.commandAppStop,
      description: "/app_stop - Cause the application to crash",
      authorizations: [Authorization.ADMIN],
    },
  ];

  private async notFound(): Promise<Fulfillment> {
    return { text: "Command not found" };
  }

  private async commandAppStop(): Promise<Fulfillment> {
    const timeout = 5000;
    setTimeout(() => process.exit(0), timeout);
    return { text: `Scheduled shutdown in ${timeout}ms` };
  }

  private async commandStart(_: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    const fulfillment = await AIManager.getInstance().getFullfilmentForInput({ text: "Hello!" }, ioChannel, person);
    return fulfillment;
  }

  private async commandWhoami(_: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    return { data: JSON.stringify({ ioChannel, person }, null, 2) };
  }

  private async commandAdminHelp(_: RegExpMatchArray, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    return { text: this.commandMapping.map((c) => c.description).join("\n") };
  }

  private async commandInput([, ioChannelId, personId, paramsStr]: RegExpMatchArray): Promise<Fulfillment> {
    const ioChannel = await IOChannel.findById(ioChannelId);
    if (!ioChannel) throw new Error(`Session ${ioChannelId} not found`);

    const person = await Person.findById(personId);
    if (!person) throw new Error(`Person ${personId} not found`);

    const params = JSON.parse(paramsStr);
    const result = await IOManager.getInstance().processInput(params, ioChannel, person, null);
    return { data: JSON.stringify(result, null, 2) };
  }

  private async commandQueryGet([, table, queryJson]: RegExpMatchArray): Promise<Fulfillment> {
    const query = JSON.parse(queryJson);
    const result = await Database.getInstance().getMongoose().connection.db.collection(table).find(query).toArray();
    return { data: JSON.stringify(result, null, 2) };
  }

  private async commandQueryUpdate([, table, queryJson]: RegExpMatchArray): Promise<Fulfillment> {
    const query = JSON.parse(queryJson);
    const { filter, update } = query;
    if (!filter || !update) throw new Error("Invalid query, must provide filter and update");
    const result = await Database.getInstance()
      .getMongoose()
      .connection.db.collection(table)
      .updateMany(filter, { $set: update });
    return { data: JSON.stringify(result, null, 2) };
  }

  private async commandApprovePerson([, personId]: RegExpMatchArray): Promise<Fulfillment> {
    const person = await Person.findByIdOrThrow(personId);
    person.authorizations = [...person.authorizations, Authorization.MESSAGE];
    const result = await person.save();
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

  private getCommandExecutor(text: string): (ioChannel: TIOChannel, person: TPerson) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        return async (ioChannel: TIOChannel, person: TPerson) => {
          throwIfMissingAuthorizations(person.authorizations, cmd.authorizations);
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
    person: TPerson,
  ): Promise<Fulfillment> {
    if (params.command) {
      const executor = this.getCommandExecutor(params.command);
      return executor(ioChannel, person);
    }
    throw new Error("Unable to process request");
  }
}
