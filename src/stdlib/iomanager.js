/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const Data = require("../data/index");
const config = require("../config");

const TAG = "IOManager";

const configuredDriversId = [];
const enabledDrivers = {};
const enabledAccesories = {};
const ioQueueInProcess = {};

const SESSION_SEPARATOR = "-";
const IO_QUEUE_TIMEOUT = 1000;

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
  const { queryText, audio, error, payload } = fulfillment;
  return {
    queryText,
    audio,
    error,
    payload,
    text: fulfillment.fulfillmentText
  };
}

/**
 * Process an input to a specific IO driver based on the session
 * @param {Object} fulfillment Fulfillment
 * @param {Object} session Session
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

  if (session.forwardSession) {
    console.info(TAG, "using forwardSession", session.forwardSession);
    setImmediate(() => {
      output(fulfillment, session.forwardSession);
    });
  }

  // If this driver is not up & running for this configuration,
  // the item could be handled by another platform that has that driver configured,
  // so we'll enqueue it.
  if (configuredDriversId.indexOf(session.ioId) === -1) {
    console.info(TAG, "putting in IO queue because driver is not enabled", {
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
  console.info(TAG, "output with", { payload, session });

  // Call the driver
  let result;
  try {
    result = await driver.output(payload, session);
  } catch (err) {
    result = { error: err };
  }

  console.log(TAG, "output result is", result);

  if (!result && session.fallbackSession) {
    console.info(TAG, "using fallbackSession", session.fallbackSession);
    return output(fulfillment, session.fallbackSession);
  }

  return result;
}

/**
 * Configure every accessory for that driver
 * @param {String} driverName
 */
function configureAccessoriesForDriver(driverName) {
  const driver = enabledDrivers[driverName];
  const accessories = enabledAccesories[driverName] || [];
  for (const accessory of accessories) {
    accessory.startInput(driver);
  }
}

/**
 * Configure driver by handling its input event,
 * parsing it and re-calling the output method of the driver
 * @param {String} driverName
 * @param {Function} onDriverInputCallback
 */
function configureDriver(driverName, onDriverInputCallback) {
  const driver = enabledDrivers[driverName];
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

  for (const driverName of driversToLoad) {
    try {
      const driver = getDriver(driverName);
      const driverId = `${config.uid}${SESSION_SEPARATOR}${driverName}`;

      if (config.serverMode && driver.onlyClientMode) {
        console.error(
          TAG,
          `unable to load <${driverName}> because this IO is not compatible with SERVER mode`
        );
        continue;
      }

      if (!config.serverMode && driver.onlyServerMode) {
        console.error(
          TAG,
          `unable to load <${driverName}> because this IO is not compatible with CLIENT mode`
        );
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
function loadAccessories() {
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
function loadListeners() {
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
 * @param {String} params
 * @param {Object} session
 */
async function writeLogForSession(params, session) {
  const sessionInput = new Data.SessionInput({
    ...params,
    session: session.id,
    createdAt: new Date()
  });
  await sessionInput.save();
  return sessionInput;
}

/**
 * Load the session from ORM
 * @param {String} sessionIdComposite
 * @returns {Promise<Object>}
 */
async function getSession(sessionIdComposite) {
  return Data.Session.findById(sessionIdComposite);
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
  const ioId = [config.uid, ioDriver].join(SESSION_SEPARATOR);
  const sessionIdComposite = [config.uid, ioDriver, sessionId]
    .filter(e => e)
    .join(SESSION_SEPARATOR);

  let session = await getSession(sessionIdComposite);

  if (!session) {
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
    console.info(TAG, "new session model registered", session);
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
async function start(onDriverInput) {
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

module.exports = {
  output,
  registerSession,
  getSession,
  writeLogForSession,
  start
};
