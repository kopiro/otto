import { config as dotEnvConfig } from "dotenv";
import config from "./config";
import * as Sentry from "@sentry/node";
import * as Database from "./stdlib/database";
import { Signale } from "signale";
import { Interaction } from "./data/interaction";
import { IOChannel } from "./data/io-channel";

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

    await Database.connect();

    if (config().env === "development" && config().cleanEnvironment) {
      logger.info("Cleaning database");
      await Interaction.deleteMany({ managerUid: config().uid });
      await IOChannel.deleteMany({ managerUid: config().uid });
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}
