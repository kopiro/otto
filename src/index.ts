import "./boot";

import mongoose from "mongoose";
import config from "./config";
import * as AI from "./stdlib/ai";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import Scheduler from "./stdlib/scheduler";

mongoose.connection.once("open", async () => {
  console.info("Database connection succeded");

  if (config().serverMode) {
    Server.start();
  }

  IOManager.start(AI.processInput);

  if (config().scheduler) {
    Scheduler.start();
  }
});
