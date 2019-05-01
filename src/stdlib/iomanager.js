const Events = require('events');
const Translator = require('../lib/translator');
const Data = require('../data');
const config = require('../config');
const { timeout } = require('../helpers');

const TAG = 'IOManager';

const configuredDriversId = [];
const enabledDrivers = {};
const enabledAccesories = {};
const enabledListeners = {};
const queueProcessing = {};

const emitter = new Events.EventEmitter();

const SESSION_SEPARATOR = '-';
let globalSession = null;

/**
 * Define constants used when forwarding output to an accessory
 */
const CAN_HANDLE_OUTPUT = {
  YES_AND_BREAK: 'yes_and_break',
  YES_AND_CONTINUE: 'yes_and_continue',
  NO: 'no',
};

/**
 * Return true if this driver is currently enabled
 * @param {String} driverId
 */
function isIdDriverUp(driverId) {
  return configuredDriversId.indexOf(driverId) >= 0;
}

/**
 * Transform a Fulfillment by making some edits based on the current session settings
 * @param  {Object} f Fulfillment object
 * @param  {Object} session Session
 * @return {Object}
 */
async function fulfillmentTransformer(f, session) {
  // If this fulfillment has already been transformed, let's skip this
  if (f.payload && f.payload.transformerUid) {
    return f;
  }

  // Merge all objects from fulfillmentMessages into payload
  f.payload = f.payload || {};
  for (const msg of f.fulfillmentMessages || []) {
    if (!Array.isArray(msg)) {
      f.payload = { ...f.payload, ...msg.payload };
    }
  }

  // Always translate fulfillment speech in the user language
  if (f.fulfillmentText) {
    if (session.getTranslateTo() !== config.language) {
      console.log(
        TAG,
        `Translating text (${f.fulfillmentText}) to language: ${session.getTranslateTo()}`,
      );
      f.fulfillmentText = await Translator.translate(f.fulfillmentText, session.getTranslateTo());
      f.payload.translatedTo = session.getTranslateTo();
    }
  }

  f.payload.transformerUid = config.uid;
  return f;
}

/**
 * Clean fulfillment for output
 * @param {Object} fulfillment
 * @returns
 */
async function fulfillmentTransformerForOutput(f) {
  return {
    queryText: f.queryText,
    text: f.fulfillmentText,
    // Re-enable to pass audio directly from DialogFlow
    // audio: f.outputAudio,
    error: f.error,
    payload: f.payload,
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
 * @param {Object} e
 * @param {Object} e.session Session object
 * @param {Object} e.params Input params object
 * @param {Object} e.fulfillment A DialogFlow direct fulfillment
 * @param {String} e.params.text A text query to parse over DialogFlow
 * @param {Object} e.params.event An event query to parse over DialogFlow
 */
async function output(f, session) {
  if (!f) {
    console.warn(
      'Do not output to driver because f is null - this could be intentional, but check your action',
    );
    return null;
  }

  // Transform and Clean fulfillment
  f = await fulfillmentTransformer(f, session);
  f = await fulfillmentTransformerForOutput(f);

  // If this fulfillment has been handled by a generator, simply skip
  if (f.payload.handledByGenerator) {
    console.warn(TAG, 'Skipping output because is handled by generator');
    return null;
  }

  console.info(TAG, 'output');
  console.dir(f);

  // If this driver is not up & running for this configuration,
  // the item could be handled by another platform that has that driver configured,
  // so we'll enqueue it.
  if (!isIdDriverUp(session.io_id)) {
    console.info(TAG, 'putting in IO queue because driver is not UP', {
      session,
      f,
    });

    await new Data.IOQueue({
      session: session.id,
      io_id: session.io_id,
      fulfillment: f,
    }).save();

    return null;
  }

  // Redirect to another driver if is configured to do that
  // by simplying replacing the driver
  if (config.ioRedirectMap[session.io_driver] != null) {
    session.io_driver = config.ioRedirectMap[session.io_driver];
    console.info(TAG, `<${session.io_driver}> redirect output to <${session.io_driver}>`);
  }

  const driver = enabledDrivers[session.io_driver];
  if (!driver) {
    throw new Error(`Driver ${session.io_driver} is not enabled`);
  }

  // Call the output
  try {
    await driver.output(f, session);
  } catch (err) {
    console.error(TAG, 'driver output error', err);
  }

  // Process output accessories:
  // An accessory can:
  // - handle a kind of output, process it and blocking the next accessory
  // - handle a kind of output, process it but don't block the next accessory
  // - do not handle and forward to next accessory
  const accessories = enabledAccesories[session.io_driver] || [];
  for (const accessory of accessories) {
    const handleType = accessory.canHandleOutput(f, session);

    try {
      switch (handleType) {
        case CAN_HANDLE_OUTPUT.YES_AND_BREAK:
          await accessory.output(f, session);
          return { forwardedToAccessory: accessory.id };
        case CAN_HANDLE_OUTPUT.YES_AND_CONTINUE:
          await accessory.output(f, session);
          break;
        case CAN_HANDLE_OUTPUT.NO:
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(TAG, 'accessory output error', err);
    }
  }

  return true;
}

/**
 * Configure every accessory for that driver
 * @param {String} driverStr
 */
async function configureAccessories(driverStr) {
  const driver = enabledDrivers[driverStr];
  for (const accessory of enabledAccesories[driverStr] || []) {
    accessory.attach(driver);
  }
}

/**
 * Configure driver by handling its input event,
 * parsing it and re-calling the output method of the driver
 * @param {String} driverStr
 */
async function configureDriver(driverStr, onDriverInput) {
  const driver = enabledDrivers[driverStr];

  driver.emitter.on('input', onDriverInput);

  await configureAccessories(driverStr);
  return driver.startInput();
}

/**
 * Return an array of drivers strings to load
 */
function getDriversToLoad() {
  if (process.env.OTTO_IO_DRIVERS) return process.env.OTTO_IO_DRIVERS.split(',');
  return config.ioDrivers || [];
}

/**
 * Return an array of accessories strings to load for that driver
 * @param {String} driver
 */
function getAccessoriesToLoad(driver) {
  if (process.env.OTTO_IO_ACCESSORIES) return process.env.OTTO_IO_ACCESSORIES.split(',');
  return config.ioAccessoriesMap[driver] || [];
}

/**
 * Return an array of listeners strings to load
 */
function getListenersToLoad() {
  if (process.env.OTTO_IO_LISTENERS) return process.env.OTTO_IO_LISTENERS.split(',');
  return config.listeners || [];
}

/**
 * Effectively load configured drivers
 */
async function loadDrivers() {
  const driversToLoad = getDriversToLoad();

  for (const driverStr of driversToLoad) {
    try {
      const driver = getDriver(driverStr);

      if (config.serverMode && driver.onlyClientMode) {
        console.error(
          TAG,
          `unable to load <${driverStr}> because this IO is not compatible with SERVER mode`,
        );
        continue;
      }

      if (!config.serverMode && driver.onlyServerMode) {
        console.error(
          TAG,
          `unable to load <${driverStr}> because this IO is not compatible with CLIENT mode`,
        );
        continue;
      }

      enabledDrivers[driverStr] = driver;

      const driverId = `${config.uid}${SESSION_SEPARATOR}${driverStr}`;
      configuredDriversId.push(driverId);
      driver.emitter.emit('loaded');

      console.log(TAG, `driver loaded with id: <${driverId}>`);
    } catch (err) {
      console.error(TAG, `driver <${driverStr}> caused error`, err);
    }
  }
}

/**
 * Effectively load configured accessories for each enabled driver
 */
async function loadAccessories() {
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
async function loadListeners() {
  const listenersToLoad = getListenersToLoad();

  for (const listenerStr of listenersToLoad) {
    const listener = getListener(listenerStr);
    enabledListeners[listenerStr] = listener;
    listener.listen();
  }
}

/**
 * Encode an object to be sure that can be passed to API requests
 * @param {Object} b
 */
function encodeBody(b) {
  return {
    body: new Buffer(JSON.stringify(b)).toString('base64'),
  };
}

/**
 * Decode an object previously encoded via IOManager.encodeBody
 * @param {Object} fulfillment
 */
function decodeBody(fulfillment) {
  return JSON.parse(new Buffer(fulfillment.payload.body, 'base64').toString('ascii'));
}

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
 * Write a log of what user said
 * @param {Object} session
 * @param {String} text
 */
async function writeLogForSession(text, session) {
  return new Data.SessionInput({
    session: session.id,
    text,
  }).save();
}

/**
 * Load the session from ORM
 * @param {String} sessionIdComposite
 */
async function getSession(sessionIdComposite) {
  return Data.Session.findOne({
    _id: sessionIdComposite,
  });
}

/**
 * Register a new session onto ORM
 * @param {Object} e
 */
async function registerSession({
  sessionId, io_driver, io_data, alias,
}) {
  const io_id = `${config.uid}${SESSION_SEPARATOR}${io_driver}`;
  const sessionIdComposite = `${io_id}${sessionId ? SESSION_SEPARATOR : ''}${sessionId}`;

  let session = await getSession(sessionIdComposite);

  if (session == null) {
    console.info(TAG, `a new session model registered: ${sessionId}`);
    session = await new Data.Session({
      _id: sessionIdComposite,
      io_id,
      io_driver,
      io_data,
      alias,
      settings: {
        updated_at: Date.now(),
      },
      pipe: {
        updated_at: Date.now(),
      },
      server_settings: config.uid,
    }).save();
  }

  if (!sessionId && !globalSession) {
    updateGlobalSession(session);
  }

  return session;
}

/**
 * Register this session as global session, available via IOManager.session
 * @param {Object} session
 */
function updateGlobalSession(session) {
  console.info(TAG, 'updating global session model');
  globalSession = session;
  emitter.emit('session_ready');
}

/**
 * Process items in the queue based on configured drivers
 */
async function processQueue() {
  const qitem = await Data.IOQueue.findOne({
    io_id: {
      $in: configuredDriversId,
    },
  });

  if (!qitem) {
    return { itemNull: true };
  }

  // Lock current item to avoid double processing
  if (queueProcessing[qitem._id]) {
    return { alreadyProcessedId: qitem._id };
  }

  queueProcessing[qitem._id] = true;

  console.info(TAG, 'processing queue item');
  console.dir(qitem, { depth: 2 });

  qitem.remove();
  output(qitem.fulfillment, qitem.session);

  return qitem;
}

/**
 * Start the polling to process IO queue
 */
async function startQueuePolling() {
  processQueue();
  await timeout(1000);
  startQueuePolling();
}

/**
 * Start drivers, accessories and listeners
 */
async function start({ onDriverInput }) {
  await loadDrivers();
  await loadAccessories();

  for (const driverStr of Object.keys(enabledDrivers)) {
    try {
      await configureDriver(driverStr, onDriverInput);
    } catch (err) {
      console.error(TAG, `Unable to activate driver <${driverStr}>: ${err}`);
    }
  }

  await loadListeners();
  startQueuePolling();
}

/**
 * Get the global session
 */
function getGlobalSession() {
  return globalSession;
}

module.exports = {
  emitter,
  SESSION_SEPARATOR,
  CAN_HANDLE_OUTPUT,
  eventToAllIO,
  output,
  registerSession,
  encodeBody,
  decodeBody,
  getSession,
  writeLogForSession,
  fulfillmentTransformer,
  start,
  getGlobalSession,
};
