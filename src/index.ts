import "./boot";

import config from "./config";
import ai from "./stdlib/ai";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import * as Database from "./stdlib/database";
import scheduler from "./stdlib/scheduler";

Database.connect()
  .then(() => {
    console.info("Database connection succeded");

    if (config().serverMode) {
      Server.start();
    }

    if (config().scheduler?.enabled) {
      scheduler().start();
    }

    IOManager.start((params, session) => {
      ai().processInput(params, session);
    });
  })
  .catch((err) => {
    console.error("Database connection error", err);
    process.exit(1);
  });
