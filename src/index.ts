import config from "./config";
import ai from "./stdlib/ai";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import scheduler from "./stdlib/scheduler";
import { Signale } from "signale";
import { warmup } from "./boot";

warmup().then(() => {
  if (config().serverMode) {
    Server.start();
  }

  if (config().scheduler?.enabled) {
    scheduler().start();
  }

  IOManager.start((params, session) => {
    ai().processInput(params, session);
  });
});
