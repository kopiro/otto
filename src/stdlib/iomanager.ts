import * as Data from "../data/index";
import config from "../config";
import {
  Session,
  IODriverModule,
  IOListenerModule,
  IOAccessoryModule,
  Fulfillment,
  InputParams,
  IOQueue,
} from "../types";

const TAG = "IOManager";

const configuredDriversId: Array<string> = [];
const enabledDrivers: Record<string, IODriverModule> = {};
const enabledAccesories = {};
const ioQueueInProcess = {};

/**
 * The separator between paths in the session ID definition
 */
const SESSION_SEPARATOR = "-";

/**
 * Define the polling timeout for the queue
 */
const IO_QUEUE_TIMEOUT = 1000;

/**
 * Load the driver module
 */
export function getDriver(e: string): IODriverModule {
  return require(`../io/${e}`);
}

/**
 * Load the listener module
 */
export function getListener(e: string): IOListenerModule {
  return require(`../listeners/${e}`);
}

/**
 * Load the accessory module
 */
export function getAccessory(e: string): IOAccessoryModule {
  return require(`../io_accessories/${e}`);
}

/**
 * Clean fulfillment for output
 */
export function fulfillmentTransformerForDriverOutput(fulfillment) {
  const { queryText, audio, error, payload } = fulfillment;
  return {
    queryText,
    audio,
    error,
    payload,
    text: fulfillment.fulfillmentText,
  };
}

/**
 * Process an input to a specific IO driver based on the session
 */
export async function output(fulfillment: Fulfillment, session: Session): Promise<boolean> {
  if (!fulfillment) {
    console.warn(
      "Do not output to driver because fulfillment is null - this could be intentional, but check your action",
    );
    return null;
  }

  // If this fulfillment has been handled by a generator, simply skip
  if (fulfillment.payload && fulfillment.payload.handledByGenerator) {
    console.warn(TAG, "Skipping output because is handled by an external generator");
    return null;
  }

  // Redirecting output to another session
  if (session.redirectSession) {
    console.info(TAG, "using redirectSession", session.redirectSession);
    return output(fulfillment, session.redirectSession);
  }

  // If this driver is not up & running for this configuration,
  // the item could be handled by another platform that has that driver configured,
  // so we'll enqueue it.
  if (configuredDriversId.indexOf(session.ioId) === -1) {
    console.info(
      TAG,
      `putting in IO queue because driver <${session.ioId}> of session <${
        session.id
      }> is not this list [${configuredDriversId.join()}]`,
    );

    const ioQueueElement = new Data.IOQueue({
      session: session.id,
      ioId: session.ioId,
      fulfillment,
    });
    await ioQueueElement.save();

    return null;
  }

  const driver = enabledDrivers[session.ioDriver];
  if (!driver) {
    throw new Error(`Driver <${session.ioDriver}> is not enabled`);
  }

  if (session.forwardSession) {
    console.info(TAG, "using forwardSession", session.forwardSession);
    setImmediate(() => {
      output(fulfillment, session.forwardSession);
    });
  }

  // Transform and clean fulfillment to be suitable for driver output
  const payload = fulfillmentTransformerForDriverOutput(fulfillment);
  console.info(TAG, "output with", { payload, session });

  // Call the driver
  let result;
  try {
    result = await driver.output(payload, session);
  } catch (err) {
    result = { error: err };
  }

  if (!result && session.fallbackSession) {
    console.info(TAG, "using fallbackSession", session.fallbackSession);
    return output(fulfillment, session.fallbackSession);
  }

  return result;
}

/**
 * Configure every accessory for that driver
 */
export function configureAccessoriesForDriver(driverName: string) {
  const driver = enabledDrivers[driverName];
  const accessories = enabledAccesories[driverName] || [];
  for (const accessory of accessories) {
    accessory.startInput(driver);
  }
}

/**
 * Configure driver by handling its input event,
 * parsing it and re-calling the output method of the driver
 */
export function configureDriver(driverName: string, onDriverInput: (params: InputParams, session: Session) => void) {
  const driver = enabledDrivers[driverName];
  driver.emitter.on("input", ({ params, session }) => {
    onDriverInput(params as InputParams, session as Session);
  });
  driver.start();
}

/**
 * Return an array of drivers strings to load
 */
export function getDriversToLoad(): Array<string> {
  if (process.env.OTTO_IO_DRIVERS) {
    return process.env.OTTO_IO_DRIVERS.split(",");
  }
  return config().ioDrivers || [];
}

/**
 * Return an array of accessories strings to load for that driver
 */
export function getAccessoriesToLoad(driver: string): Array<string> {
  if (process.env.OTTO_IO_ACCESSORIES) {
    return process.env.OTTO_IO_ACCESSORIES.split(",");
  }
  return config().ioAccessoriesMap[driver] || [];
}

/**
 * Return an array of listeners strings to load
 */
export function getListenersToLoad(): Array<string> {
  if (process.env.OTTO_IO_LISTENERS) {
    return process.env.OTTO_IO_LISTENERS.split(",");
  }
  return config().listeners || [];
}

/**
 * Effectively load configured drivers
 */
export function loadDrivers(): Record<string, IODriverModule> {
  const driversToLoad = getDriversToLoad();

  for (const driverName of driversToLoad) {
    try {
      const driver = getDriver(driverName);
      const driverId = `${config().uid}${SESSION_SEPARATOR}${driverName}`;

      if (config().serverMode && driver.onlyClientMode) {
        console.error(TAG, `unable to load <${driverName}> because this IO is not compatible with SERVER mode`);
        continue;
      }

      if (!config().serverMode && driver.onlyServerMode) {
        console.error(TAG, `unable to load <${driverName}> because this IO is not compatible with CLIENT mode`);
        continue;
      }

      enabledDrivers[driverName] = driver;
      configuredDriversId.push(driverId);

      driver.emitter.emit("loaded");
      console.log(TAG, `driver loaded with id: <${driverId}>`);
    } catch (err) {
      console.error(TAG, `driver <${driverName}> caused error`, err);
    }
  }

  return enabledDrivers;
}

/**
 * Effectively load configured accessories for each enabled driver
 */
export function loadAccessories(): void {
  const driversToLoad = getDriversToLoad();

  for (const driverName of driversToLoad) {
    enabledAccesories[driverName] = [];
    const accessoriesToLoad = getAccessoriesToLoad(driverName);
    for (const accessoryId of accessoriesToLoad) {
      const accessory = getAccessory(accessoryId);
      enabledAccesories[driverName].push(accessory);
    }
  }
}

/**
 * Effectively load configured listeners
 */
export function loadListeners(): void {
  const listenersToLoad = getListenersToLoad();

  for (const listenerName of listenersToLoad) {
    try {
      const listener = getListener(listenerName);
      listener.start();
      console.log(TAG, `listener <${listenerName}> started`);
    } catch (err) {
      console.error(TAG, `listener <${listenerName}> error`, err);
    }
  }
}

/**
 * Write a log of what user said
 */
export async function writeLogForSession(params: InputParams, session: Session) {
  const sessionInput = new Data.SessionInput({
    ...params,
    session: session.id,
    createdAt: new Date(),
  });
  await sessionInput.save();
  return sessionInput;
}

/**
 * Load the session from ORM
 */
export async function getSession(sessionId: string): Promise<Session> {
  const session = await Data.Session.findById(sessionId);
  return (session as unknown) as Session;
}

/**
 * Register a new session onto ORM
 */
export async function registerSession(
  ioDriver: string,
  sessionId?: string,
  ioData?: any,
  alias?: string,
): Promise<Session> {
  const ioId = [config().uid, ioDriver].join(SESSION_SEPARATOR);
  const sessionIdComposite = [config().uid, ioDriver, sessionId].filter(e => e).join(SESSION_SEPARATOR);

  const session = await getSession(sessionIdComposite);

  if (!session) {
    const freshSession = new Data.Session({
      _id: sessionIdComposite,
      ioId,
      ioDriver,
      ioData,
      alias,
      settings: {
        updated_at: Date.now(),
      },
      pipe: {
        updated_at: Date.now(),
      },
      serverSettings: config().uid,
    });
    await freshSession.save();
    console.info(TAG, "new session model registered", session);
    return (freshSession as unknown) as Session;
  }

  return session;
}

/**
 * Get the next item into the queue to proces
 */
export async function getNextInQueue(): Promise<IOQueue> {
  return await Data.IOQueue.findOne({
    ioId: {
      $in: configuredDriversId,
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

  console.info(TAG, "processing queue item");
  console.dir(qitem, { depth: 2 });

  qitem.remove();

  await output(qitem.fulfillment, qitem.session);

  return qitem;
}

/**
 * Start drivers, accessories and listeners
 */
export async function start(onDriverInput: (params: InputParams, session: Session) => void) {
  loadDrivers();
  loadAccessories();
  loadListeners();

  for (const driverName of Object.keys(enabledDrivers)) {
    try {
      configureDriver(driverName, onDriverInput);
      configureAccessoriesForDriver(driverName);
    } catch (err) {
      console.error(TAG, `Unable to activate driver <${driverName}>`, err);
    }
  }

  setInterval(processIOQueue, IO_QUEUE_TIMEOUT);
}
