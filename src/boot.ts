import { config as dotEnvConfig } from "dotenv";
import config from "./config";
import * as Sentry from "@sentry/node";
import { Database } from "./stdlib/database";

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
    console.error(err);
    process.exit(1);
  }
}
