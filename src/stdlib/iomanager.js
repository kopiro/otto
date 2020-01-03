/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const Events = require("events");
const Data = require("../data/index");
const config = require("../config");

const TAG = "IOManager";

const configuredDriversId = [];
const enabledDrivers = {};
const enabledAccesories = {};
const queueProcessing = {};

const emitter = new Events.EventEmitter();

const SESSION_SEPARATOR = "-";

/**
 * Define constants used when forwarding output to an accessory
 */
const CAN_HANDLE_OUTPUT = {
  YES_AND_BREAK: "yes_and_break",
  YES_AND_CONTINUE: "yes_and_continue",
  NO: "no"
};

/**
 * Load the driver module
 * @param {String} e
 */
function getDriver(e) {
  return require(`../io/${e}`);
}

/**
 * Load the listener module
 * @param {String} e
 */
function getListener(e) {
  return require(`../listeners/${e}`);
}

/**
 * Load the accessory module
 * @param {String} e
 */
function getAccessory(e) {
  return require(`../io_accessories/${e}`);
}

/**
 * Clean fulfillment for output
 * @param {Object} fulfillment
 * @return {Object}
 */
function fulfillmentTransformerForDriverOutput(fulfillment) {
  return {
    queryText: fulfillment.queryText,
    text: fulfillment.fulfillmentText,
    audio: fulfillment.audio,
    error: fulfillment.error,
    payload: fulfillment.payload
  };
}

/**
 * Send an event with data to all IO drivers
 * @param {String} name Name of the event
 * @param {Object} data Payload for the event
 */
function eventToAllIO(name, data) {
  for (const k of Object.keys(enabledDrivers)) {
    enabledDrivers[k].emitter.emit(name, data);
  }
}

/**
 * Process an input to a specific IO driver based on the session
 * @param {Object} fulfillment Fulfillment object
 * @param {Object} session Session object
 */
async function output(fulfillment, session) {
  if (!fulfillment) {
    console.warn(
      "Do not output to driver because fulfillment is null - this could be intentional, but check your action"
    );
    return null;
  }

  // If this fulfillment has been handled by a generator, simply skip
  if (fulfillment.payload && fulfillment.payload.handledByGenerator) {
    console.warn(
      TAG,
      "Skipping output because is handled by an external generator"
    );
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
    console.info(TAG, "putting in IO queue because driver is not UP", {
      session,
      fulfillment,
      configuredDriversId
    });

    const ioQueueElement = new Data.IOQueue({
      session: session.id,
      ioId: session.ioId,
      fulfillment
    });
    await ioQueueElement.save();

    return null;
  }

  const driver = enabledDrivers[session.ioDriver];
  if (!driver) {
    throw new Error(`Driver <${session.ioDriver}> is not enabled`);
  }

  // Transform and clean fulfillment to be suitable for driver output
  const payload = fulfillmentTransformerForDriverOutput(fulfillment);

  // Call the driver
  let driverOutputResult = null;
  try {
    console.info(TAG, "output with", { payload, session });
    driverOutputResult = await driver.output(payload, session);
  } catch (err) {
    driverOutputResult = { error: err };
    console.error(TAG, "driver output error", err);
  }

  console.log(TAG, "output result is", driverOutputResult);

  if (!driverOutputResult && session.fallbackSession) {
    console.info(TAG, "using fallbackSession", session.fallbackSession);
    return output(fulfillment, session.fallbackSession);
  }

  // Process output accessories:
  // An accessory can:
  // - handle a kind of output, process it and blocking the next accessory
  // - handle a kind of output, process it but don't block the next accessory
  // - do not handle and forward to next accessory
  // const accessoriesOutputResults = [];
  // const accessories = enabledAccesories[session.ioDriver] || [];

  // for (const accessory of accessories) {
  //   const handleType = accessory.canHandleOutput(payload, session);
  //   let accessoryOutput = null;

  //   try {
  //     switch (handleType) {
  //       case CAN_HANDLE_OUTPUT.YES_AND_BREAK:
  //         accessoryOutput = await accessory.output(payload, session);
  //         return { forwardedToAccessory: accessory.id };
  //       case CAN_HANDLE_OUTPUT.YES_AND_CONTINUE:
  //         accessoryOutput = await accessory.output(payload, session);
  //         break;
  //       case CAN_HANDLE_OUTPUT.NO:
  //         break;
  //       default:
  //         break;
  //     }
  //   } catch (err) {
  //     accessoryOutput = { error: err };
  //     console.error(TAG, "accessory output error", err);
  //   }

  //   accessoriesOutputResults.push(accessoryOutput);
  // }

  return { driverOutputResult };
}

/**
 * Configure every accessory for that driver
 * @param {String} driverStr
 */
function configureAccessoriesForDriver(driverStr) {
  const driver = enabledDrivers[driverStr];
  const accessories = enabledAccesories[driverStr] || [];
  for (const accessory of accessories) {
    accessory.start(driver);
  }
}

/**
 * Configure driver by handling its input event,
 * parsing it and re-calling the output method of the driver
 * @param {String} driverStr
 * @param {Function} onDriverInputCallback
 */
function configureDriver(driverStr, onDriverInputCallback) {
  const driver = enabledDrivers[driverStr];
  driver.emitter.on("input", onDriverInputCallback);
  driver.start();
}

/**
 * Return an array of drivers strings to load
 * @return {Array<String>}
 */
function getDriversToLoad() {
  if (process.env.OTTO_IO_DRIVERS) {
    return process.env.OTTO_IO_DRIVERS.split(",");
  }
  return config.ioDrivers || [];
}

/**
 * Return an array of accessories strings to load for that driver
 * @param {String} driver
 * @return {Array<String>}
 */
function getAccessoriesToLoad(driver) {
  if (process.env.OTTO_IO_ACCESSORIES) {
    return process.env.OTTO_IO_ACCESSORIES.split(",");
  }
  return config.ioAccessoriesMap[driver] || [];
}

/**
 * Return an array of listeners strings to load
 * @return {Array<String>}
 */
function getListenersToLoad() {
  if (process.env.OTTO_IO_LISTENERS) {
    return process.env.OTTO_IO_LISTENERS.split(",");
  }
  return config.listeners || [];
}

/**
 * Effectively load configured drivers
 */
function loadDrivers() {
  const driversToLoad = getDriversToLoad();

  for (const driverStr of driversToLoad) {
    try {
      const driver = getDriver(driverStr);
      const driverId = `${config.uid}${SESSION_SEPARATOR}${driverStr}`;

      if (config.serverMode && driver.onlyClientMode) {
        console.error(
          TAG,
          `unable to load <${driverStr}> because this IO is not compatible with SERVER mode`
        );
        continue;
      }

      if (!config.serverMode && driver.onlyServerMode) {
        console.error(
          TAG,
          `unable to load <${driverStr}> because this IO is not compatible with CLIENT mode`
        );
        continue;
      }

      enabledDrivers[driverStr] = driver;
      configuredDriversId.push(driverId);

      driver.emitter.emit("loaded");
      console.log(TAG, `driver loaded with id: <${driverId}>`);
    } catch (err) {
      console.error(TAG, `driver <${driverStr}> caused error`, err);
    }
  }
}

/**
 * Effectively load configured accessories for each enabled driver
 */
function loadAccessories() {
  const driversToLoad = getDriversToLoad();

  for (const driverStr of driversToLoad) {
    enabledAccesories[driverStr] = [];
    const accessoriesToLoad = getAccessoriesToLoad(driverStr);
    for (const accessoryId of accessoriesToLoad) {
      const accessory = getAccessory(accessoryId);
      enabledAccesories[driverStr].push(accessory);
    }
  }
}

/**
 * Effectively load configured listeners
 */
function loadListeners() {
  const listenersToLoad = getListenersToLoad();

  for (const listenerStr of listenersToLoad) {
    try {
      const listener = getListener(listenerStr);
      listener.start();
      console.log(TAG, `listener <${listenerStr}> started`);
    } catch (err) {
      console.error(TAG, `listener <${listenerStr}> error: ${err}`);
    }
  }
}

/**
 * Write a log of what user said
 * @param {Object} session
 * @param {String} text
 */
async function writeLogForSession(text, session) {
  return new Data.SessionInput({
    session: session.id,
    text
  }).save();
}

/**
 * Load the session from ORM
 * @param {String} sessionIdComposite
 * @returns {Promise<Object>}
 */
async function getSession(sessionIdComposite) {
  return Data.Session.findOne({
    _id: sessionIdComposite
  });
}

/**
 * Register a new session onto ORM
 * @param {Object} e
 */
async function registerSession({
  sessionId = "",
  ioData = {},
  ioDriver,
  alias
}) {
  const ioId = `${config.uid}${SESSION_SEPARATOR}${ioDriver}`;
  const sessionIdComposite = `${ioId}${
    sessionId ? SESSION_SEPARATOR : ""
  }${sessionId}`;

  let session = await getSession(sessionIdComposite);

  if (!session) {
    console.info(TAG, `a new session model registered: ${sessionId}`);
    session = new Data.Session({
      _id: sessionIdComposite,
      ioId,
      ioDriver,
      ioData,
      alias,
      settings: {
        updated_at: Date.now()
      },
      pipe: {
        updated_at: Date.now()
      },
      serverSettings: config.uid
    });
    await session.save();
  }

  return session;
}

/**
 * Process items in the queue based on configured drivers
 */
async function processIOQueue() {
  const qitem = await Data.IOQueue.findOne({
    ioId: {
      $in: configuredDriversId
    }
  });

  if (!qitem) {
    return { itemNull: true };
  }

  // Lock current item to avoid double processing
  if (queueProcessing[qitem._id]) {
    return { alreadyProcessedId: qitem._id };
  }

  queueProcessing[qitem._id] = true;

  console.info(TAG, "processing queue item");
  console.dir(qitem, { depth: 2 });

  qitem.remove();

  await output(qitem.fulfillment, qitem.session);

  return qitem;
}

/**
 * Start drivers, accessories and listeners
 */
async function start({ onDriverInput }) {
  await loadDrivers();
  await loadAccessories();
  await loadListeners();

  for (const driverStr of Object.keys(enabledDrivers)) {
    try {
      configureDriver(driverStr, onDriverInput);
      configureAccessoriesForDriver(driverStr);
    } catch (err) {
      console.error(TAG, `Unable to activate driver <${driverStr}>: ${err}`);
    }
  }

  setInterval(processIOQueue, 1000);
}

module.exports = {
  emitter,
  SESSION_SEPARATOR,
  CAN_HANDLE_OUTPUT,
  eventToAllIO,
  output,
  registerSession,
  getSession,
  writeLogForSession,
  start
};
