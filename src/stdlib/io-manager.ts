import config from "../config";
import { Authorization, Output, IErrorWithData, Input, EmotionContext } from "../types";
import { EventEmitter } from "events";
import { Signale } from "signale";
import { TIOChannel } from "../data/io-channel";
import { IOQueue, TIOQueue } from "../data/io-queue";
import { isDocument, isDocumentArray } from "@typegoose/typegoose";
import { AIManager } from "./ai/ai-manager";
import { TPerson } from "../data/person";
import { IODataTelegram, IOBagTelegram } from "../io/telegram";
import TypedEmitter from "typed-emitter";
import { IOBagWeb, IODataWeb } from "../io/web";
import { IOBagVoice, IODataVoice } from "../io/voice";
import { randomUUID } from "crypto";
import { Interaction } from "../data/interaction";
import { report, throwIfMissingAuthorizations } from "../helpers";
import { AuthorizationError } from "../errors/authorization-error";

const TAG = "IOManager";
const logger = new Signale({
  scope: TAG,
});

const THINKING_INTERVAL = 4000;

export enum OutputSource {
  queue = "queue",
  input = "input",
  report = "report",
  scheduler = "scheduler",
  mirror = "mirror",
  api = "api",
}

export type IODriverId = "telegram" | "voice" | "web";
export type IOAccessoryId = "gpio-button" | "leds";
export type IOBag = IOBagTelegram | IOBagWeb | IOBagVoice;
export type IOData = IODataTelegram | IODataWeb | IODataVoice;

export type IODriverSingleOutput = [string, any];
export type IODriverMultiOutput = IODriverSingleOutput[];

export type IODriverEventMap = {
  input: (input: Input, ioChannel: TIOChannel, person: TPerson, bag: IOBag) => void;
  output: (output: Output, ioChannel: TIOChannel, person: TPerson, bag: IOBag) => void;
  error: (errorMessage: string, ioChannel: TIOChannel, person: TPerson) => void;
  thinking: (ioChannel: TIOChannel, person: TPerson, bag: IOBag) => void;
  recognizing: () => void;
  woken: () => void;
  wake: () => void;
  stop: () => void;
  stopped: () => void;
};

export interface IODriverRuntime {
  driverId: IODriverId;
  emitter: TypedEmitter<IODriverEventMap>;
  start: () => Promise<void>;
  output: (output: Output, ioChannel: TIOChannel, person: TPerson, bag: IOBag) => Promise<IODriverMultiOutput>;
}

export type OutputResult = {
  driverOutput?: IODriverMultiOutput;
  driverError?: Error | unknown;
  rejectReason?: {
    message: string;
    data?: any;
  };
};
export interface IOAccessoryModule {
  start: () => void;
}

export class IOManager {
  private loadedDrivers: Partial<Record<IODriverId, IODriverRuntime>> = {};
  private queueInProcess: Record<string, true> = {};

  private emitter: EventEmitter = new EventEmitter();

  private static instance: IOManager;
  public static getInstance(): IOManager {
    if (!IOManager.instance) {
      IOManager.instance = new IOManager();
    }
    return IOManager.instance;
  }

  /**
   * Return an array of drivers strings to load
   */
  private getDriversToLoad(): IODriverId[] {
    if (process.env.OTTO_IO_DRIVERS) {
      return process.env.OTTO_IO_DRIVERS.split(",") as unknown as IODriverId[];
    }
    return (config().ioDrivers || []) as unknown as IODriverId[];
  }

  /**
   * Return an array of accessories strings to load for that driver
   */
  private getAccessoriesToLoadForDriver(driver: IODriverId): IOAccessoryId[] {
    if (process.env.OTTO_IO_ACCESSORIES) {
      return process.env.OTTO_IO_ACCESSORIES.split(",") as unknown as IOAccessoryId[];
    }
    return (config().ioAccessoriesMap as Record<IODriverId, IOAccessoryId[]>)[driver] || [];
  }

  /**
   * Load the driver module
   */
  private async loadDriver(driverId: IODriverId): Promise<IODriverRuntime> {
    switch (driverId) {
      case "telegram":
        return (await import("../io/telegram")).default();
      case "voice":
        return (await import("../io/voice")).default();
      case "web":
        return (await import("../io/web")).default();
      default:
        throw new Error(`Invalid driver: ${driverId}`);
    }
  }

  /**
   * Load the accessory module
   */
  private async getAccessoryForDriver(
    accessoryName: IOAccessoryId,
    driver: IODriverRuntime,
  ): Promise<IOAccessoryModule> {
    switch (accessoryName) {
      case "gpio-button":
        return new (await import("../io_accessories/gpio-button")).default(driver);
      case "leds":
        return new (await import("../io_accessories/leds")).default(driver);
      default:
        throw new Error(`Invalid accessory: ${accessoryName}`);
    }
  }

  canHandleIOChannelInThisNode(ioChannel: TIOChannel): boolean {
    const result = ioChannel.managerUid === config().uid;
    if (!result) {
      logger.warn(
        `This node can't handle this IO channel (${ioChannel.id}) (them: ${ioChannel.managerUid}, us: ${config().uid})`,
      );
    }
    return result;
  }

  async scheduleInQueue(
    data: { input: Input } | { output: Output },
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag,
  ): Promise<OutputResult> {
    const ioQueueElement = await IOQueue.createNew(data, ioChannel, person, bag);
    logger.info("Scheduling in queue", ioQueueElement);
    return {
      rejectReason: {
        message: "IO_SCHEDULED",
        data: {
          ioQueueElementId: ioQueueElement.id,
        },
      },
    };
  }

  async maybeRedirectOutput(
    output: Output,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag | null,
    { inputId, source }: { inputId?: string | null; source?: OutputSource | null } = {},
  ) {
    await ioChannel.populate("redirectOutputToIOChannelIds");

    if (isDocumentArray(ioChannel.redirectOutputToIOChannelIds) && ioChannel.redirectOutputToIOChannelIds.length > 0) {
      logger.info("The channel is redirecting the output to other channels", {
        from: ioChannel.toJSONDebug(),
        to: ioChannel.redirectOutputToIOChannelIds.map((s) => s.id),
      });

      await Promise.all(
        ioChannel.redirectOutputToIOChannelIds.map((ioChannelToRedirectTo) => {
          if (ioChannelToRedirectTo.id === ioChannel.id) {
            logger.warn("Redirecting to same ioChannel, skipping to avoid recursion", ioChannelToRedirectTo);
            return;
          }

          return this.output(output, ioChannelToRedirectTo, person, bag, {
            inputId,
            source,
            wasRedirectedTo: true,
          });
        }),
      );
    }
  }

  async updateEmotions(emotionsUpdates: EmotionContext, person: TPerson) {
    // Update emotions
    if (emotionsUpdates) {
      const currentEmotions = person.getEmotions();
      logger.info(`Updating emotions for ${person.getName()}`, emotionsUpdates);

      for (const key in emotionsUpdates) {
        const increment = emotionsUpdates[key as keyof EmotionContext];
        const currentValue = currentEmotions[key as keyof EmotionContext];
        const newValue = currentValue + increment;
        currentEmotions[key as keyof EmotionContext] = newValue;
      }

      person.emotions = currentEmotions;
      return person.save();
    }
  }

  /**
   * Process an input to a specific IO driver based on the ioChannel
   */
  async output(
    output: Output,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag | null,
    {
      inputId,
      source,
      wasRedirectedTo,
    }: { inputId?: string | null; source?: OutputSource | null; wasRedirectedTo?: boolean } = {},
  ): Promise<OutputResult> {
    logger.debug("Output", {
      time: new Date(),
      output,
      ioChannel: ioChannel.toJSONDebug(),
      person: person.toJSONDebug(),
      bag,
      source,
      wasRedirectedTo,
      inputId,
    });

    if (!this.canHandleIOChannelInThisNode(ioChannel)) {
      return this.scheduleInQueue({ output }, ioChannel, person, bag);
    }

    if (!wasRedirectedTo) {
      Interaction.createNew(
        {
          output,
        },
        ioChannel,
        person,
        inputId ?? null,
        source ?? null,
      );
    }

    // Update emotions
    if (output.emotionsUpdates) {
      this.updateEmotions(output.emotionsUpdates, person);
    }

    // Redirecting output to another ioChannel, asyncronously
    // Only do this when this output is not coming from the IOQueue, otherwise it will be redirected twice
    this.maybeRedirectOutput(output, ioChannel, person, bag, {
      inputId,
      source,
    });

    if (ioChannel.doNotDisturb === true) {
      logger.info("rejecting because doNotDisturb is ON", ioChannel);
      return { rejectReason: { message: "DO_NOT_DISTURB_ON" } };
    }

    const driverRuntime = this.loadedDrivers[ioChannel.ioDriver];
    if (!driverRuntime) {
      logger.warn("Driver not enabled", ioChannel);
      return { rejectReason: { message: "DRIVER_NOT_ENABLED" } };
    }

    try {
      // Actually output to the driver
      driverRuntime.emitter.emit("output", output, ioChannel, person, bag);
      const driverOutput = await driverRuntime.output(output, ioChannel, person, bag);
      return { driverOutput };
    } catch (err) {
      logger.error("Driver Output error:", err);
      return { driverError: err };
    }
  }

  /**
   * Configure every accessory for that driver
   */
  private async startAccessoriesForDriver(driverId: IODriverId, driver: IODriverRuntime) {
    const accessoriesToLoad = this.getAccessoriesToLoadForDriver(driverId);
    return Promise.all(
      accessoriesToLoad.map((accessory) =>
        this.getAccessoryForDriver(accessory, driver).then((accessoryModule) => accessoryModule.start()),
      ),
    );
  }

  private async onDriverInput(
    input: Input,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag,
  ): Promise<OutputResult | OutputResult[]> {
    // Check if we have repeatTo - if so, just output to all of them
    ioChannel.populate("mirrorInputToOutputToChannelIds");

    if (
      isDocumentArray(ioChannel.mirrorInputToOutputToChannelIds) &&
      ioChannel.mirrorInputToOutputToChannelIds.length > 0
    ) {
      logger.info(
        "Reflecting input to direct output to channels",
        ioChannel.mirrorInputToOutputToChannelIds.map((e) => e.id),
      );

      return Promise.all(
        ioChannel.mirrorInputToOutputToChannelIds.map((e) => {
          return this.output(input as Output, e, person, bag, {
            source: OutputSource.mirror,
          });
        }),
      );
    }

    return this.input(input, ioChannel, person, bag);
  }

  private onDriverError(message: string, ioChannel: TIOChannel, person: TPerson) {
    logger.error("Driver emitted error", message, ioChannel.id, person.id);
  }

  startDrivers() {
    const drivers = this.getDriversToLoad();
    logger.pending("Starting drivers", drivers);

    return Promise.allSettled(
      drivers.map(async (driverId) => {
        try {
          const driverRuntime = await this.loadDriver(driverId);

          // Route the input to the right driver
          driverRuntime.emitter.on("input", this.onDriverInput.bind(this));
          driverRuntime.emitter.on("error", this.onDriverError.bind(this));

          await driverRuntime.start();
          await this.startAccessoriesForDriver(driverId, driverRuntime);

          this.loadedDrivers[driverId] = driverRuntime;
        } catch (err) {
          logger.error(`IO.${driverId} error on startup:`, (err as Error)?.message);
        }
      }),
    );
  }

  /**
   * Process items in the queue based on configured drivers
   */
  async processQueue(callback?: (item: TIOQueue | null) => void): Promise<TIOQueue | null> {
    const qitem = await IOQueue.getNextInQueue();

    if (!qitem || this.queueInProcess[qitem.id]) {
      callback?.(null);
      return null;
    }

    if (!isDocument(qitem.ioChannel)) {
      logger.error("IOQueue item has no ioChannel, removing it", qitem);
      await qitem.deleteOne();
      return null;
    }

    this.queueInProcess[qitem.id] = true;

    logger.info("Processing IOQueue item", qitem);

    callback?.(qitem);

    await qitem.deleteOne();

    if (!isDocument(qitem.person)) {
      logger.error("IOQueue item has no person, removing it", qitem);
      return null;
    }

    if (qitem.input) {
      await this.input(qitem.input, qitem.ioChannel, qitem.person, qitem.bag);
    } else if (qitem.output) {
      await this.output(qitem.output, qitem.ioChannel, qitem.person, qitem.bag, {
        source: OutputSource.queue,
      });
    } else {
      logger.warn("IOQueue item has either no input nor output", qitem);
    }

    return qitem;
  }

  /**
   * Input an item to the IOManager
   */
  async input(input: Input, ioChannel: TIOChannel, person: TPerson, bag: IOBag | null): Promise<OutputResult> {
    if (!this.canHandleIOChannelInThisNode(ioChannel)) {
      return this.scheduleInQueue({ input }, ioChannel, person, bag);
    }

    const inputId = randomUUID();

    const driverRuntime = this.loadedDrivers[ioChannel.ioDriver];
    if (!driverRuntime) {
      logger.warn("Driver not enabled", ioChannel);
      return { rejectReason: { message: "DRIVER_NOT_ENABLED" } };
    }

    logger.debug("Input", {
      time: new Date(),
      input,
      ioChannel: ioChannel.toJSONDebug(),
      person: person.toJSONDebug(),
      bag,
      inputId,
    });

    Interaction.createNew(
      {
        input,
      },
      ioChannel,
      person,
      inputId,
      null,
    );

    const thinkCallback = () => {
      driverRuntime.emitter.emit("thinking", ioChannel, person, bag);
    };

    // Emit the thinking event to show progress
    thinkCallback();
    const intervalId = setInterval(thinkCallback, THINKING_INTERVAL);

    let output: Output | null = null;

    try {
      throwIfMissingAuthorizations(person.authorizations, [Authorization.MESSAGE]);
      output = await AIManager.getInstance().getFullfilmentForInput(input, ioChannel, person);
    } catch (err) {
      if (err instanceof AuthorizationError) {
        report({
          message: `Person <b>${person.getName()}</b> (<code>${
            person.id
          }</code>) on channel <b>${ioChannel.getName()}</b> (<code>${
            ioChannel.id
          }</code> is trying to perform an action without the following authorization: <code>${
            err.requiredAuth
          }</code>`,
          data: JSON.stringify({ input }),
        });
      }
      logger.error("Error getting output", err);
      output = { error: err as IErrorWithData };
    }

    // Stop the thinking interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    const result = await this.output(output, ioChannel, person, bag, {
      inputId,
      source: OutputSource.input,
    });

    return result;
  }

  /**
   * Start drivers and start processing the queue
   */
  async start() {
    await this.startDrivers();

    const { ioQueue } = config();
    if (ioQueue?.enabled) {
      if (!ioQueue?.timeout) {
        throw new Error("ioQueue.timeout is not set");
      }
      logger.success(`IOQueue processing started (every ${ioQueue.timeout}ms)`);
      setInterval(this.processQueue.bind(this), ioQueue.timeout);
    } else {
      logger.warn("IOQueue is disabled");
    }
  }
}
