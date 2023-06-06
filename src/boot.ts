// https://github.com/yagop/node-telegram-bot-api/issues/540
process.env.NTBA_FIX_319 = "1";

import { config as dotEnvConfig } from "dotenv";
import config from "./config";
import * as Sentry from "@sentry/node";
import * as Database from "./stdlib/database";

export async function warmup() {
  try {
    dotEnvConfig();

    if (!config().uid) {
      throw new Error("Please define config.uid with your Universal ID (username)");
    }

    if (config().sentry?.dsn && process.env.NODE_ENV === "production") {
      Sentry.init(config().sentry);
    }

    await Database.connect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
