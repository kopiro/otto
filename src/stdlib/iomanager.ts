import config from "../config";
import { Fulfillment, InputParams } from "../types";
import { EventEmitter } from "events";
import { Signale } from "signale";
import { TSession } from "../data/session";
import { IOQueue, TIOQueue } from "../data/ioqueue";
import { isDocument, isDocumentArray } from "@typegoose/typegoose";
import { AIManager } from "./ai/ai-manager";

const TAG = "IOManager";
const logger = new Signale({
  scope: TAG,
});

export type IODriverId = "telegram" | "human" | "web";
export type IOAccessoryId = "gpio_button" | "leds";
export type IOBag = any;

export type StartArgs = {
  onDriverInput: (params: InputParams, session: TSession) => void;
};

export type IODriverOutput = [string, any][];
export interface IODriverRuntime {
  emitter: EventEmitter;
  start: () => Promise<void>;
  output: (fulfillment: Fulfillment, session: TSession, bag: IOBag) => Promise<IODriverOutput>;
}

export type OutputResult = {
  driverOutput?: IODriverOutput;
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
  private loadedDrivers: Record<string, IODriverRuntime> = {};
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
      case "human":
        return (await import("../io/human")).default();
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
      case "gpio_button":
        return new (await import("../io_accessories/gpio_button")).default(driver);
      case "leds":
        return new (await import("../io_accessories/leds")).default(driver);
      default:
        throw new Error(`Invalid accessory: ${accessoryName}`);
    }
  }

  canHandleOutput(_: Fulfillment, session: TSession): boolean {
    return session.managerUid === config().uid && Object.keys(this.loadedDrivers).includes(session.ioDriver);
  }

  async outputInQueue(fulfillment: Fulfillment, session: TSession, bag?: IOBag): Promise<OutputResult> {
    const loadedDriverIds = Object.keys(this.loadedDrivers);

    const ioQueueElement = await IOQueue.create({
      session: session.id,
      fulfillment,
      a: 1,
      dateAdded: new Date(),
    });

    return {
      rejectReason: {
        message: "OUTPUT_QUEUED",
        data: {
          loadedDriverIds,
          sessionId: session.id,
          ioQueueElementId: ioQueueElement.id,
        },
      },
    };
  }

  async redirectOutputToRedirectSessions(
    fulfillment: Fulfillment | null,
    session: TSession,
    bag?: IOBag,
    loadDriverIfNotEnabled = false,
  ) {
    // Redirecting output to another session, asyncronously
    await session.populate("redirectSessions");

    if (isDocumentArray(session.redirectSessions) && session.redirectSessions.length > 0) {
      logger.info(
        "using redirectSessions",
        session.redirectSessions.map((s) => s.id),
      );

      await Promise.all(
        session.redirectSessions.map((sess) => {
          if (sess.id === session.id) {
            logger.warn("Redirecting to same session, skipping", sess);
            return;
          }

          return this.output(fulfillment, sess, bag, loadDriverIfNotEnabled);
        }),
      );
    }
  }

  /**
   * Process an input to a specific IO driver based on the session
   */
  async output(
    fulfillment: Fulfillment | null,
    session: TSession,
    bag?: IOBag,
    loadDriverIfNotEnabled = false,
  ): Promise<OutputResult> {
    // Redirecting output to another session, asyncronously
    this.redirectOutputToRedirectSessions(fulfillment, session, bag, loadDriverIfNotEnabled);

    if (!fulfillment) {
      logger.warn("Early return cause fulfillment is null - this could be intentional, but check your action");
      return { rejectReason: { message: "FULFILLMENT_IS_NULL" } };
    }

    if (session.doNotDisturb === true) {
      logger.info("rejecting because doNotDisturb is ON", session);
      return { rejectReason: { message: "DO_NOT_DISTURB_ON" } };
    }

    let driverRuntime: IODriverRuntime = this.loadedDrivers[session.ioDriver];
    if (!driverRuntime && loadDriverIfNotEnabled) {
      driverRuntime = await this.loadDriver(session.ioDriver);
    }

    if (!this.canHandleOutput(fulfillment, session)) {
      logger.debug("This configuration is not able to fulfill this output, putting in IO queue", fulfillment, session);
      return this.outputInQueue(fulfillment, session, bag);
    }

    if (!driverRuntime) {
      return { rejectReason: { message: "DRIVER_NOT_ENABLED" } };
    }

    // Actually output to the driver
    try {
      const driverOutput = await driverRuntime.output(fulfillment, session, bag);
      return { driverOutput };
    } catch (driverError) {
      return { driverError };
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

  private async onDriverInput(params: InputParams, session: TSession) {
    await session.populate("repeatModeSessions");

    // Check if we have repeatModeSessions - if so, just output to all of them
    if (isDocumentArray(session.repeatModeSessions) && session.repeatModeSessions.length > 0) {
      logger.info(
        "Using repeatModeSessions",
        session.repeatModeSessions.map((e) => e.id),
      );

      if (!params.text) {
        throw new Error("repeatModeSessions requires text");
      }

      return Promise.all(
        session.repeatModeSessions.map((repeaterSession) => {
          return this.output({ text: params.text, analytics: { engine: "repeater" } }, repeaterSession, params.bag);
        }),
      );
    }

    return this.processInput(params, session);
  }

  startDrivers() {
    return Promise.all(
      this.getDriversToLoad().map(async (driverId) => {
        const driverRuntime = await this.loadDriver(driverId);

        // Route the input to the right driver
        driverRuntime.emitter.on("input", (e) => {
          if (!e.params || !e.session) {
            logger.error("Driver emitted unkown event", e);
            return;
          }

          this.onDriverInput(e.params, e.session);
        });

        await driverRuntime.start();
        await this.startAccessoriesForDriver(driverId, driverRuntime);

        this.loadedDrivers[driverId] = driverRuntime;

        logger.debug(`Driver ${driverId} started!`);
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
    }).sort({ dateAdded: +1 });
  }

  /**
   * Process items in the queue based on configured drivers
   */
  async processQueue(callback?: (item: TIOQueue | null) => void): Promise<TIOQueue | null> {
    const qitem = await this.getNextInQueue();
    if (!qitem || this.queueInProcess[qitem.id]) {
      callback?.(null);
      return null;
    }

    if (!isDocument(qitem.session)) {
      logger.error("IOQueue item has no session, removing it", qitem);
      await qitem.deleteOne();
      return null;
    }

    this.queueInProcess[qitem.id] = true;

    logger.info("Processing IOQueue item", {
      fulfillment: qitem.fulfillment,
      "session.id": qitem.session.id,
      bag: qitem.bag,
    });

    callback?.(qitem);

    await qitem.deleteOne();
    await this.output(qitem.fulfillment, qitem.session, qitem.bag);

    return qitem;
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: TSession): Promise<OutputResult> {
    logger.info("input", { params, session: session.id });
    const fulfillment = await AIManager.getInstance().getFullfilmentForInput(params, session);
    logger.info("fulfillment", { fulfillment, session: session.id });
    const result = await IOManager.getInstance().output(fulfillment, session, params.bag);
    logger.info("output result", { result, session: session.id });
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
      logger.info("Starting IOQueue processing");
      setInterval(this.processQueue.bind(this), ioQueue.timeout);
    }
  }
}
