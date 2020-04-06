import "./boot";

import mongoose from "mongoose";
import config from "./config";
import * as AI from "./stdlib/ai";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import * as Scheduler from "./stdlib/scheduler";

mongoose.connection.once("open", async () => {
  console.info("Database connection succeded");

  if (config().serverMode) {
    Server.start();
    AI.attachToServer(Server);
  }

  IOManager.start(AI.processInput);

  if (config().scheduler) {
    Scheduler.start();
  }
});
