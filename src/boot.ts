process.env.NTBA_FIX_319 = "1";
require("dotenv").config();

import mongoose from "mongoose";
import config from "./config";
import * as Sentry from "@sentry/node";

if (!config().uid) {
  console.error("Please define config.uid with your Universal ID (username)");
  process.exit(1);
}

if (config().sentry?.dsn && process.env.NODE_ENV === "production") {
  Sentry.init(config().sentry);
}

mongoose.connect(
  `mongodb://${config().mongo.user}:${config().mongo.password}@${config().mongo.host}:${config().mongo.port}/${
    config().mongo.database
  }`,
  { useNewUrlParser: true, useUnifiedTopology: true },
);

mongoose.connection.on("error", async (err) => {
  console.error("Database connection error", err);
  process.exit(1);
});
