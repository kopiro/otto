import config from "./config";
import * as Server from "./stdlib/server";
import * as IOManager from "./stdlib/iomanager";
import scheduler from "./stdlib/scheduler";
import { warmup } from "./boot";
import { AIManager } from "./stdlib/ai/ai-manager";

warmup().then(() => {
  if (config().serverMode) {
    Server.start();
  }

  if (config().scheduler?.enabled) {
    scheduler().start();
  }

  IOManager.start({
    onDriverInput: (params, session) => {
      AIManager.getInstance().processInput(params, session);
    },
  });
});
