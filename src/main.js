require("./boot");

const mongoose = require("mongoose");
const config = require("./config");
const AI = require("./stdlib/ai");
const Server = require("./stdlib/server");
const IOManager = require("./stdlib/iomanager");
const Scheduler = require("./stdlib/scheduler");

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
    AI.attachToServer(Server);
  } else {
    console.info("Running in CLIENT mode");
  }

  IOManager.start(AI.processInput);

  if (config.scheduler) {
    Scheduler.start();
  }
});
