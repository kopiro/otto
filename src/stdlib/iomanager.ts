import * as Data from "../data/index";
import config from "../config";
import { Session, Fulfillment, InputParams, IOQueue } from "../types";
import { EventEmitter } from "events";
import { Signale } from "signale";

const TAG = "IOManager";
const console = new Signale({
  scope: TAG,
});

export type IODriver = "telegram" | "human" | "web";
export type IOAccessory = "gpio_button" | "leds";

export type IOBag = any;

type StartArgs = {
  onDriverInput: (params: InputParams, session: Session) => void;
};

export enum Authorizations {
  "ADMIN" = "ADMIN",
  "CAMERA" = "CAMERA",
  "COMMAND" = "COMMAND",
}

export type IODriverOutput = [string | null, any][];
export interface IODriverModule {
  emitter: EventEmitter;
  start: () => Promise<void>;
  output: (fulfillment: Fulfillment, session: Session, bag: IOBag) => Promise<IODriverOutput>;
}

export type OutputResult = {
  driverOutput?: IODriverOutput;
  driverError?: Error;
  rejectReason?: {
    message: string;
    data?: Record<string, any>;
  };
};
export interface IOAccessoryModule {
  start: () => void;
}

type IODriverId = string;

const enabledDriverIds: Array<IODriverId> = [];

const enabledDrivers: Record<string, IODriverModule> = {};
const ioQueueInProcess = {};

/**
 * The separator between paths in the session ID definition
 */
const SESSION_SEPARATOR = "$";

/**
 * Return an array of drivers strings to load
 */
export function getDriversToLoad(): IODriver[] {
  if (process.env.OTTO_IO_DRIVERS) {
    return process.env.OTTO_IO_DRIVERS.split(",") as unknown as IODriver[];
  }
  return config().ioDrivers || [];
}

/**
 * Return an array of accessories strings to load for that driver
 */
export function getAccessoriesToLoadForDriver(driver: IODriver): IOAccessory[] {
  if (process.env.OTTO_IO_ACCESSORIES) {
    return process.env.OTTO_IO_ACCESSORIES.split(",") as unknown as IOAccessory[];
  }
  return config().ioAccessoriesMap[driver] || [];
}

/**
 * Load the driver module
 */
export async function getDriver(e: IODriver): Promise<IODriverModule> {
  switch (e) {
    case "telegram":
      return (await import("../io/telegram")).default();
    case "human":
      return (await import("../io/human")).default();
    case "web":
      return (await import("../io/web")).default();
    default:
      throw new Error(`Invalid driver: ${e}`);
  }
}

/**
 * Load the accessory module
 */
export async function getAccessoryForDriver(e: IOAccessory, driver: IODriverModule): Promise<IOAccessoryModule> {
  switch (e) {
    case "gpio_button":
      return new (await import("../io_accessories/gpio_button")).default(driver);
    case "leds":
      return new (await import("../io_accessories/leds")).default(driver);
    default:
      throw new Error(`Invalid accessory: ${e}`);
  }
}

/**
 * Process an input to a specific IO driver based on the session
 */
export async function output(
  fulfillment: Fulfillment | null,
  session: Session,
  bag?: IOBag,
  loadDriverIfNotEnabled = false,
): Promise<OutputResult> {
  if (!fulfillment) {
    console.warn("Early return cause fulfillment is null - this could be intentional, but check your action");
    return { rejectReason: { message: "FULFILLMENT_IS_NULL" } };
  }

  // Redirecting output to another session
  if (session.redirectSessions?.length > 0) {
    console.info("using redirectSessions", session.redirectSessions);
    Promise.all(session.redirectSessions.map((e) => output(fulfillment, e, bag, loadDriverIfNotEnabled)));
  }

  if (session.doNotDisturb) {
    console.info("rejecting because doNotDisturb is ON", session);
    return { rejectReason: { message: "DO_NOT_DISTURB_ON" } };
  }

  let driver: IODriverModule;

  if (loadDriverIfNotEnabled) {
    driver = await getDriver(session.ioDriver);
  } else {
    // If this driver is not up & running for this configuration,
    // the item could be handled by another platform that has that driver configured,
    // so we'll enqueue it.
    if (!enabledDriverIds.includes(session.ioId)) {
      const el = {
        session: session.id,
        ioId: session.ioId,
        fulfillment,
        dateAdded: new Date(),
      };
      console.info(
        TAG,
        `putting in IO queue because driver <${session.ioId}> of session <${
          session.id
        }> is not this list [${enabledDriverIds.join()}]`,
        JSON.stringify(el, null, 2),
      );

      const ioQueueElement = new Data.IOQueue(el);
      await ioQueueElement.save();

      return {
        rejectReason: {
          message: "OUTPUT_QUEUED",
          data: { enabledDriverIds, sessionId: session.id, sessionIoId: session.ioId },
        },
      };
    }

    driver = enabledDrivers[session.ioDriver];
  }

  if (!driver) {
    console.error(`Driver <${session.ioDriver}> is not enabled`);
    return { rejectReason: { message: "DRIVER_NOT_ENABLED" } };
  }

  if (session.forwardSessions?.length > 0) {
    console.info(
      "using forwardSessions",
      session.forwardSessions.map((e) => e.id),
    );
    Promise.all(session.forwardSessions.map((e) => output(fulfillment, e, bag, loadDriverIfNotEnabled)));
  }

  // Call the driver
  let driverOutput: IODriverOutput;
  let driverError: any;

  try {
    driverOutput = await driver.output(fulfillment, session, bag);
  } catch (err) {
    driverError = err;
  }

  if (driverError && session.fallbackSession) {
    console.info("using fallbackSession", session.fallbackSession.id);
    return output(fulfillment, session.fallbackSession, bag);
  }

  if (driverError) {
    return { driverError };
  }

  return { driverOutput };
}

/**
 * Configure every accessory for that driver
 */
export async function startAccessoriesForDriver(driverName: IODriver, driver: IODriverModule) {
  const accessoriesToLoad = getAccessoriesToLoadForDriver(driverName as unknown as IODriver);
  return Promise.all(
    accessoriesToLoad.map((accessory) =>
      getAccessoryForDriver(accessory, driver).then((accessoryModule) => accessoryModule.start()),
    ),
  );
}

/**
 * Effectively load configured drivers
 */
export async function configureDriver(driverName: IODriver): Promise<[IODriverModule, IODriverId]> {
  const driver = await getDriver(driverName);
  const driverId = [config().uid, driverName].join(SESSION_SEPARATOR);

  return [driver, driverId];
}

async function onDriverInputWrapper(onDriverInput: StartArgs["onDriverInput"], params: InputParams, session: Session) {
  // Check if we have repeatModeSessions - if so, just output to all of them
  if (session.repeatModeSessions?.length) {
    console.info("using repeatModeSessions", session.repeatModeSessions);

    if (!params.text) {
      throw new Error("repeatModeSessions requires text");
    }

    return Promise.all(
      session.repeatModeSessions.map((repeaterSession) => {
        return output({ text: params.text, analytics: { engine: "repeater" } }, repeaterSession, params.bag);
      }),
    );
  }

  return onDriverInput(params, session);
}

function startDrivers({ onDriverInput }: StartArgs) {
  return Promise.all(
    getDriversToLoad().map(async (driverName) => {
      configureDriver(driverName)
        .then(([driver, driverId]) => {
          return Promise.all([driver, driverId, driver.start()]);
        })
        .then(([driver, driverId]) => {
          return Promise.all([driver, driverId, startAccessoriesForDriver(driverName, driver)]);
        })
        .then(([driver, driverId]) => {
          driver.emitter.on("input", (input) => {
            if (!input.params) {
              console.error("driver emitted unkown events", input);
              return;
            }

            const params = input.params as InputParams;
            const session = input.session as Session;

            onDriverInputWrapper(onDriverInput, params, session);
          });

          enabledDrivers[driverName] = driver;
          enabledDriverIds.push(driverId);

          console.debug(`driver ${driverName} started with id: <${driverId}>`);
          return true;
        });
    }),
  );
}

function getSessionIdByParts(uid: string, ioDriver: string, sessionId: string) {
  return [uid, ioDriver, sessionId].filter((e) => e).join(SESSION_SEPARATOR);
}

/**
 * Load the session from ORM
 */
export async function getSession(sessionId: string): Promise<Session> {
  const session = await Data.Session.findById(sessionId);
  return session as unknown as Session;
}

/**
 * Register a new session onto ORM
 */
export async function registerSession(ioDriver: string, partialSessionId?: string, ioData?: any): Promise<Session> {
  const sessionId = getSessionIdByParts(config().uid, ioDriver, partialSessionId);
  const session = await getSession(sessionId);
  const ioId = [config().uid, ioDriver].join(SESSION_SEPARATOR);

  const data = {
    _id: sessionId,
    uid: config().uid,
    ioId,
    ioDriver: ioDriver as IODriver,
    ioData,
  };

  if (!session) {
    // TODO: remove this and calculate it
    const freshSession = new Data.Session(data);
    await freshSession.save();
    console.info("new session model registered", freshSession);
    return freshSession as unknown as Session;
  } else {
    await session.updateOne(data);
  }

  return session;
}

/**
 * Get the next item into the queue to proces
 */
export async function getNextInQueue(): Promise<IOQueue | null> {
  return (
    await Data.IOQueue.find({
      ioId: {
        $in: enabledDriverIds,
      },
    })
      .sort({ dateAdded: +1 })
      .limit(1)
  )?.[0];
}

/**
 * Process items in the queue based on configured drivers
 */
export async function processIOQueue(callback?: (item: IOQueue | null) => void): Promise<IOQueue | null> {
  const qitem = await getNextInQueue();
  if (!qitem || ioQueueInProcess[qitem.id]) {
    callback?.(null);
    return null;
  }

  ioQueueInProcess[qitem.id] = true;

  console.info("processing queue item", {
    fulfillment: qitem.fulfillment,
    "session.id": qitem.session,
    bag: qitem.bag,
  });
  callback?.(qitem);

  qitem.remove();

  await output(qitem.fulfillment, qitem.session, qitem.bag);

  return qitem;
}

/**
 * Start drivers and start processing the queue
 */
export async function start({ onDriverInput }: StartArgs) {
  await startDrivers({ onDriverInput });

  if (config().ioQueue?.enabled) {
    setInterval(processIOQueue, config().ioQueue.timeout);
  }
}
