import { warmup } from "./boot";
import { start as startServer } from "./stdlib/server";
import { SchedulerManager } from "./stdlib/scheduler";
import { IOManager } from "./stdlib/io-manager";

// Do not await here to start faster

(async () => {
  warmup();
  startServer();
  IOManager.getInstance().start();
  SchedulerManager.getInstance().start();
})();
