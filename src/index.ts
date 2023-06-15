import config from "./config";
import { warmup } from "./boot";
import { start as startServer } from "./stdlib/server";
import { start as startScheduler } from "./stdlib/scheduler";
import { AIManager } from "./stdlib/ai/ai-manager";
import { IOManager } from "./stdlib/iomanager";

warmup().then(() => {
  if (config().serverMode) {
    startServer();
  }

  if (config().scheduler?.enabled) {
    startScheduler();
  }

  IOManager.getInstance().start();
});
