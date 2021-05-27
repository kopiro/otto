// https://github.com/yagop/node-telegram-bot-api/issues/540
process.env.NTBA_FIX_319 = "1";

import { config as dotEnvConfig } from "dotenv";
import config from "./config";
import * as Sentry from "@sentry/node";

dotEnvConfig();

if (!config().uid) {
  console.error("Please define config.uid with your Universal ID (username)");
  process.exit(1);
}

if (config().sentry?.dsn && process.env.NODE_ENV === "production") {
  Sentry.init(config().sentry);
}
