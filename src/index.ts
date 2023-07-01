import config from "./config";
import { warmup } from "./boot";
import { start as startServer } from "./stdlib/server";
import { SchedulerManager } from "./stdlib/scheduler";
import { IOManager } from "./stdlib/io-manager";

warmup().then(async () => {
  if (config().server?.enabled) {
    await startServer();
  }

  await IOManager.getInstance().start();

  if (config().scheduler?.enabled) {
    await SchedulerManager.getInstance().start();
  }
});
