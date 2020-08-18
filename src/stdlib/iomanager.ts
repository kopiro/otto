import * as Data from "../data/index";
import config from "../config";
import { Session, Fulfillment, InputParams, IOQueue } from "../types";
import { EventEmitter } from "events";

const TAG = "IOManager";

export type IODriver = "telegram" | "human" | "web";
export type IOListener = "io_event";
export type IOAccessory = "gpio_button" | "leds";

export type IOBag = Record<string, any>;

export enum Authorizations {
  "CAMERA" = "CAMERA",
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IODriverModule {
  emitter: EventEmitter;
  start: () => void;
  output: (fulfillment: Fulfillment, session: Session, bag: IOBag) => void;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IOListenerModule {
  start: () => void;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
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
    return (process.env.OTTO_IO_DRIVERS.split(",") as unknown) as IODriver[];
  }
  return config().ioDrivers || [];
}

/**
 * Return an array of accessories strings to load for that driver
 */
export function getAccessoriesToLoadForDriver(driver: IODriver): IOAccessory[] {
  if (process.env.OTTO_IO_ACCESSORIES) {
    return (process.env.OTTO_IO_ACCESSORIES.split(",") as unknown) as IOAccessory[];
  }
  return config().ioAccessoriesMap[driver] || [];
}

/**
 * Return an array of listeners strings to load
 */
export function getListenersToLoad(): IOListener[] {
  if (process.env.OTTO_IO_LISTENERS) {
    return (process.env.OTTO_IO_LISTENERS.split(",") as unknown) as IOListener[];
  }
  return config().ioListeners || [];
}

/**
 * Load the driver module
 */
export async function getDriver(e: IODriver): Promise<IODriverModule> {
  switch (e) {
    case "telegram":
      return (await import("../io/telegram")).default;
    case "human":
      return (await import("../io/human")).default;
    case "web":
      return (await import("../io/web")).default;
    default:
      throw new Error(`Invalid driver: ${e}`);
  }
}

/**
 * Load the listener module
 */
export async function getListener(e: IOListener): Promise<IOListenerModule> {
  switch (e) {
    case "io_event":
      return (await import("../listeners/io_event")).default;
    default:
      throw new Error(`Invalid listener: ${e}`);
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
 * Clean fulfillment for output
 */
export function fulfillmentTransformerForDriverOutput(fulfillment: Fulfillment): Fulfillment {
  return fulfillment;
}

/**
 * Process an input to a specific IO driver based on the session
 */
export async function output(
  fulfillment: Fulfillment,
  session: Session,
  bag: IOBag,
  loadDriverIfNotEnabled = false,
): Promise<any> {
  if (!fulfillment) {
    console.warn(
      "Do not output to driver because fulfillment is null - this could be intentional, but check your action",
    );
    return null;
  }

  // If this fulfillment has been handled by a generator, simply skip
  if (fulfillment.payload?.handledByGenerator) {
    console.warn(TAG, "Skipping output because is handled by an external generator");
    return null;
  }

  // Redirecting output to another session
  if (session.redirectSessions?.length > 0) {
    console.info(TAG, "using redirectSessions", session.redirectSessions);
    return Promise.all(session.redirectSessions.map((e) => output(fulfillment, e, bag, loadDriverIfNotEnabled)));
  }

  let driver: IODriverModule;

  if (loadDriverIfNotEnabled) {
    driver = await getDriver(session.ioDriver);
  } else {
    // If this driver is not up & running for this configuration,
    // the item could be handled by another platform that has that driver configured,
    // so we'll enqueue it.
    if (enabledDriverIds.indexOf(session.ioId) === -1) {
      console.info(
        TAG,
        `putting in IO queue because driver <${session.ioId}> of session <${
          session.id
        }> is not this list [${enabledDriverIds.join()}]`,
      );

      const ioQueueElement = new Data.IOQueue({
        session: session.id,
        ioId: session.ioId,
        fulfillment,
      });
      await ioQueueElement.save();

      return null;
    }

    driver = enabledDrivers[session.ioDriver];
  }

  if (!driver) {
    throw new Error(`Driver <${session.ioDriver}> is not enabled`);
  }

  if (session.forwardSessions?.length > 0) {
    console.info(TAG, "using forwardSessions", session.forwardSessions);
    Promise.all(session.forwardSessions.map((e) => output(fulfillment, e, bag, loadDriverIfNotEnabled)));
  }

  // Transform and clean fulfillment to be suitable for driver output
  const payload = fulfillmentTransformerForDriverOutput(fulfillment);

  // Call the driver
  let result;
  let error;

  try {
    result = await driver.output(payload, session, bag);
  } catch (err) {
    error = err;
  }

  if (error && session.fallbackSession) {
    console.info(TAG, "using fallbackSession", session.fallbackSession.id);
    return output(fulfillment, session.fallbackSession, bag);
  }

  if (error) throw error;
  return result;
}

/**
 * Configure every accessory for that driver
 */
export async function startAccessoriesForDriver(driverName: IODriver, driver: IODriverModule) {
  const accessoriesToLoad = getAccessoriesToLoadForDriver((driverName as unknown) as IODriver);
  return Promise.all(
    accessoriesToLoad.map((accessory) => {
      return getAccessoryForDriver(accessory, driver).then((accessoryModule) => accessoryModule.start());
    }),
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

function startListeners() {
  return Promise.all(
    getListenersToLoad().map((listenerName) => {
      return getListener(listenerName)
        .then((listener) => listener.start())
        .then(() => {
          console.log(TAG, `listener ${listenerName} started`);
        });
    }),
  );
}

function startDrivers(onDriverInput: (params: InputParams, session: Session) => void) {
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
            if (input.params) {
              onDriverInput(input.params as InputParams, input.session as Session);
            } else {
              console.error(TAG, "driver emitted unkown events", input);
            }
          });

          enabledDrivers[driverName] = driver;
          enabledDriverIds.push(driverId);

          console.log(TAG, `driver ${driverName} started with id: <${driverId}>`);
          return true;
        });
    }),
  );
}

/**
 * Write a log of what user said
 */
export async function writeLogForSession(params: InputParams, session: Session) {
  return new Data.SessionInput({
    text: params.text,
    event: params.event,
    session: session.id,
    createdAt: new Date(),
  }).save();
}

function getSessionIdByParts(uid: string, ioDriver: string, sessionId: string) {
  return [uid, ioDriver, sessionId].filter((e) => e).join(SESSION_SEPARATOR);
}

/**
 * Load the session from ORM
 */
export async function getSession(sessionId: string): Promise<Session> {
  const session = await Data.Session.findById(sessionId);
  return (session as unknown) as Session;
}

/**
 * Load the session from ORM
 */
export async function getSessionByParts(uid: string, ioDriver: string, sessionId: string): Promise<Session> {
  return getSession(getSessionIdByParts(uid, ioDriver, sessionId));
}

/**
 * Register a new session onto ORM
 */
export async function registerSession(ioDriver: string, sessionId?: string, ioData?: any): Promise<Session> {
  const session = await getSessionByParts(config().uid, ioDriver, sessionId);
  const sessionIdComposite = getSessionIdByParts(config().uid, ioDriver, sessionId);
  const ioId = [config().uid, ioDriver].join(SESSION_SEPARATOR);

  const data = {
    _id: sessionIdComposite,
    uid: config().uid,
    ioId,
    ioDriver,
    ioData,
  };

  if (!session) {
    // TODO: remove this and calculate it
    const freshSession = new Data.Session(data);
    await freshSession.save();
    console.info(TAG, "new session model registered", freshSession);
    return (freshSession as unknown) as Session;
  } else {
    await session.updateOne(data);
  }

  return session;
}

/**
 * Get the next item into the queue to proces
 */
export async function getNextInQueue(): Promise<IOQueue> {
  return await Data.IOQueue.findOne({
    ioId: {
      $in: enabledDriverIds,
    },
  });
}

/**
 * Process items in the queue based on configured drivers
 */
export async function processIOQueue(): Promise<IOQueue | null> {
  const qitem = await getNextInQueue();
  if (!qitem || ioQueueInProcess[qitem.id]) {
    return null;
  }

  ioQueueInProcess[qitem.id] = true;

  console.info(TAG, "processing queue item", {
    fulfillment: qitem.fulfillment,
    "session.id": qitem.session,
    bag: qitem.bag,
  });

  qitem.remove();

  await output(qitem.fulfillment, qitem.session, qitem.bag);

  return qitem;
}

/**
 * Start drivers, accessories and listeners
 */
export async function start(onDriverInput: (params: InputParams, session: Session) => void) {
  try {
    await startDrivers(onDriverInput);
  } catch (err) {
    console.error(err);
  }

  try {
    await startListeners();
  } catch (err) {
    console.error(TAG, err);
  }

  if (config().ioQueue?.enabled) {
    setInterval(processIOQueue, config().ioQueue.timeout);
  }
}
