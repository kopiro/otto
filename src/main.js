const path = require("path");

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
  __dirname,
  "../keys/gcloud.json"
);
process.env.AWS_KEY_PATH = path.resolve(__dirname, "../keys/aws.json");

const mongoose = require("mongoose");
const config = require("./config");
const AI = require("./stdlib/ai");
const Server = require("./stdlib/server");
const IOManager = require("./stdlib/iomanager");
const Scheduler = require("./stdlib/scheduler");

// Replace normal console with a better colorful console
require("console-ultimate/global").replace();

if (!config.uid) {
  console.error("Please define config.uid with your Universal ID (username)");
  process.exit(1);
}

if (config.raven && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line global-require
  require("raven")
    .config(config.raven)
    .install();
}

console.info("Connecting to database...");
mongoose.connect(
  `mongodb://${config.mongo.user}:${config.mongo.password}@${config.mongo.host}:${config.mongo.port}/${config.mongo.database}`,
  { useNewUrlParser: true }
);

mongoose.connection.on("error", async err => {
  console.error("Database connection error", err);
  process.exit(1);
});

mongoose.connection.once("open", async () => {
  console.info("Database connection succeded");

  if (config.serverMode) {
    console.info("Running in SERVER mode");
    Server.start();
    AI.attachToServer();
  } else {
    console.info("Running in CLIENT mode");
  }

  IOManager.start({
    onDriverInput: AI.processInput
  });

  if (config.scheduler) {
    Scheduler.start();
  }
});
