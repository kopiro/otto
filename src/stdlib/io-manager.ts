import config from "../config";
import { Authorization, Fulfillment, IErrorWithData, InputParams } from "../types";
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

export enum OutputSource {
  queue = "queue",
  input = "input",
  report = "report",
  scheduler = "scheduler",
  command = "command",
  mirror = "mirror",
}

export type IODriverId = "telegram" | "voice" | "web";
export type IOAccessoryId = "gpio-button" | "leds";
export type IOBag = IOBagTelegram | IOBagWeb | IOBagVoice;
export type IOData = IODataTelegram | IODataWeb | IODataVoice;

export type IODriverSingleOutput = [string, any];
export type IODriverMultiOutput = IODriverSingleOutput[];

export type IODriverEventMap = {
  input: (params: InputParams, ioChannel: TIOChannel, person: TPerson, bag: IOBag) => void;
  error: (message: string, ioChannel: TIOChannel, person: TPerson) => void;
  output: (fulfillment: Fulfillment, ioChannel: TIOChannel, person: TPerson, bag: IOBag) => void;
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
  output: (
    fulfillment: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag,
  ) => Promise<IODriverMultiOutput>;
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

  canHandleOutput(fulfillment: Fulfillment, ioChannel: TIOChannel): boolean {
    const result =
      ioChannel.managerUid === config().uid && Object.keys(this.loadedDrivers).includes(ioChannel.ioDriver);
    if (!result) {
      logger.debug(`This node can't output for this channel, putting in IO queue for other node to pick it up`, {
        fulfillment,
        ioChannel: ioChannel,
        us: {
          managerUid: config().uid,
          loadedDrivers: Object.keys(this.loadedDrivers),
        },
      });
    }
    return result;
  }

  async outputInQueue(
    fulfillment: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag,
    inputId: string | null,
  ): Promise<OutputResult> {
    const loadedDriverIds = Object.keys(this.loadedDrivers);

    const ioQueueElement = await IOQueue.createNew(fulfillment, ioChannel, person, bag, inputId);

    return {
      rejectReason: {
        message: "OUTPUT_QUEUED",
        data: {
          loadedDriverIds,
          ioQueueElementId: ioQueueElement.id,
        },
      },
    };
  }

  async maybeRedirectFulfillment(
    fulfillment: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag | null,
    loadDriverIfNotEnabled = false,
    inputId: string | null,
    source: OutputSource,
  ) {
    // Redirecting output to another ioChannel, asyncronously
    await ioChannel.populate("redirectFulfillmentTo");

    if (isDocumentArray(ioChannel.redirectFulfillmentTo) && ioChannel.redirectFulfillmentTo.length > 0) {
      logger.info(
        `The channel ${ioChannel.id} is redirecting the fulfillment to other channels:`,
        ioChannel.redirectFulfillmentTo.map((s) => s.id),
      );

      await Promise.all(
        ioChannel.redirectFulfillmentTo.map((e) => {
          if (e.id === ioChannel.id) {
            logger.warn("Redirecting to same ioChannel, skipping", e);
            return;
          }

          return this.output(fulfillment, e, person, bag, loadDriverIfNotEnabled, inputId, source);
        }),
      );
    }
  }

  /**
   * Process an input to a specific IO driver based on the ioChannel
   */
  async output(
    fulfillment: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag | null,
    loadDriverIfNotEnabled = false,
    inputId: string | null,
    source: OutputSource,
  ): Promise<OutputResult> {
    // TODO: support multiple params
    if (fulfillment.text) {
      Interaction.createNew(
        {
          fulfillment,
        },
        ioChannel,
        person,
        inputId,
      );
    }

    // Redirecting output to another ioChannel, asyncronously
    // Only do this when this output is not coming from the IOQueue, otherwise it will be redirected twice
    if (source !== OutputSource.queue) {
      setImmediate(() => {
        this.maybeRedirectFulfillment(fulfillment, ioChannel, person, bag, loadDriverIfNotEnabled, inputId, source);
      });
    }

    if (ioChannel.doNotDisturb === true) {
      logger.info("rejecting because doNotDisturb is ON", ioChannel);
      return { rejectReason: { message: "DO_NOT_DISTURB_ON" } };
    }

    let driverRuntime = this.loadedDrivers[ioChannel.ioDriver];
    if (!driverRuntime && loadDriverIfNotEnabled) {
      driverRuntime = await this.loadDriver(ioChannel.ioDriver);
    }

    if (!this.canHandleOutput(fulfillment, ioChannel)) {
      return this.outputInQueue(fulfillment, ioChannel, person, bag, inputId);
    }

    if (!driverRuntime) {
      logger.warn("Driver not enabled", ioChannel);
      return { rejectReason: { message: "DRIVER_NOT_ENABLED" } };
    }

    try {
      // Actually output to the driver
      driverRuntime.emitter.emit("output", fulfillment, ioChannel, person, bag);
      const driverOutput = await driverRuntime.output(fulfillment, ioChannel, person, bag);
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
    params: InputParams,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag,
  ): Promise<OutputResult | OutputResult[]> {
    await ioChannel.populate("mirrorInputToFulfillmentTo");

    // Check if we have repeatTo - if so, just output to all of them
    if (isDocumentArray(ioChannel.mirrorInputToFulfillmentTo) && ioChannel.mirrorInputToFulfillmentTo.length > 0) {
      logger.info(
        "Using mirrorInputToFulfillment",
        ioChannel.mirrorInputToFulfillmentTo.map((e) => e.id),
      );

      return Promise.all(
        ioChannel.mirrorInputToFulfillmentTo.map((e) => {
          return this.output(params as Fulfillment, e, person, bag, false, null, OutputSource.mirror);
        }),
      );
    }

    return this.input(params, ioChannel, person, bag);
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
   * Get the next item into the queue to proces
   */
  async getNextInQueue() {
    return IOQueue.findOne({
      managerUid: config().uid,
      ioDriver: {
        $in: Object.keys(this.loadedDrivers),
      },
    }).sort({ createdAt: +1 });
  }

  /**
   * Process items in the queue based on configured drivers
   */
  async processQueue(callback?: (item: TIOQueue | null) => void): Promise<TIOQueue | null> {
    const enabledDriverIds = Object.keys(this.loadedDrivers) as IODriverId[];
    const qitem = await IOQueue.getNextInQueue(enabledDriverIds);

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

    logger.info("Processing IOQueue item", {
      fulfillment: qitem.fulfillment,
      ioChannel: qitem.ioChannel.id,
      person: qitem.person.id,
      bag: qitem.bag,
      inputId: qitem.inputId,
    });

    callback?.(qitem);

    await qitem.deleteOne();

    if (!isDocument(qitem.person)) {
      logger.error("IOQueue item has no person, removing it", qitem);
      return null;
    }

    const { fulfillment, ioChannel, person, bag, inputId } = qitem;
    await this.output(fulfillment, ioChannel, person, bag, false, inputId, OutputSource.queue);

    return qitem;
  }

  /**
   * Process a fulfillment to a ioChannel
   */
  async input(params: InputParams, ioChannel: TIOChannel, person: TPerson, bag: IOBag | null): Promise<OutputResult> {
    const inputId = randomUUID();

    logger.debug("Input:", { inputId, params, ioChannelId: ioChannel?.id, personId: person.id });

    // TODO: support multiple params
    if ("text" in params) {
      Interaction.createNew(
        {
          input: params,
        },
        ioChannel,
        person,
        inputId,
      );
    }

    let fulfillment: Fulfillment | null = null;
    try {
      throwIfMissingAuthorizations(person.authorizations, [Authorization.MESSAGE]);
      fulfillment = await AIManager.getInstance().getFullfilmentForInput(params, ioChannel, person);
    } catch (err) {
      if (err instanceof AuthorizationError) {
        report({
          message: `Person <b>${person.name}</b> (<code>${person.id}</code>) on channel <code>${ioChannel.id}</code> is trying to perform an action without the following authorization: <code>${err.requiredAuth}</code>`,
          data: JSON.stringify({ params }),
        });
      }
      fulfillment = { error: err as IErrorWithData };
    }

    logger.debug("Fulfillment: ", { inputId, fulfillment });

    const result = await IOManager.getInstance().output(
      fulfillment,
      ioChannel,
      person,
      bag,
      false,
      inputId,
      OutputSource.input,
    );
    logger.debug(`Result`, {
      inputId,
      result,
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
    }
  }
}
