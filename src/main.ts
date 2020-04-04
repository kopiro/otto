import mongoose from "mongoose";
import config from "./config";
import * as AI from "./stdlib/ai";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import * as Scheduler from "./stdlib/scheduler";

if (!config().uid) {
  console.error("Please define config.uid with your Universal ID (username)");
  process.exit(1);
}

if (config().raven && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line global-require
  require("raven")
    .config(config().raven)
    .install();
}

console.info("Connecting to database...");
mongoose.connect(
  `mongodb://${config().mongo.user}:${config().mongo.password}@${config().mongo.host}:${config().mongo.port}/${
    config().mongo.database
  }`,
  { useNewUrlParser: true },
);

mongoose.connection.on("error", async err => {
  console.error("Database connection error", err);
  process.exit(1);
});

mongoose.connection.once("open", async () => {
  console.info("Database connection succeded");

  if (config().serverMode) {
    console.info("Running in SERVER mode");
    Server.start();
    AI.attachToServer(Server);
  } else {
    console.info("Running in CLIENT mode");
  }

  IOManager.start(AI.processInput);

  if (config().scheduler) {
    Scheduler.start();
  }
});
