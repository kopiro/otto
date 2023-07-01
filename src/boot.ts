import { config as dotEnvConfig } from "dotenv";
import config from "./config";
import * as Sentry from "@sentry/node";
import { Database } from "./stdlib/database";
import { Signale } from "signale";

const TAG = "Boot";
const logger = new Signale({
  scope: TAG,
});

export async function warmup() {
  try {
    dotEnvConfig();

    if (!config().uid) {
      throw new Error("Please define config.uid with a unique identifier for this instance.");
    }

    if (config().sentry?.dsn && config().env) {
      Sentry.init(config().sentry);
    }

    await Database.getInstance().connect();
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}
