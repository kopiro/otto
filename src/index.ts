import "./boot";

import mongoose from "mongoose";
import config from "./config";
import AI from "./stdlib/ai";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import Scheduler from "./stdlib/scheduler";

mongoose.connection.once("open", async () => {
  console.info("Database connection succeded");

  if (config().serverMode) {
    Server.start();
  }

  IOManager.start((params, session) => {
    AI.processInput(params, session);
  });

  if (config().scheduler?.enabled) {
    Scheduler.start();
  }
});
