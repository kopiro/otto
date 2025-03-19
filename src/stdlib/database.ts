import mongoose from "mongoose";
import config from "../config";
import { Signale } from "signale";

const TAG = "Database";
const logger = new Signale({
  scope: TAG,
});

export class Database {
  private static instance: Database;

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  getMongoose(): typeof mongoose {
    return mongoose;
  }

  getUrl(): string {
    const { user, password, host, port, database } = config().mongo;
    return `mongodb://${user}:${password}@${host}:${port}/${database}?authSource=admin`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const _config = config().mongo;
      if (!_config.enabled) {
        logger.warn("Database is disabled");
        return resolve();
      }

      logger.pending("Connecting to database...");

      mongoose.connect(this.getUrl());

      mongoose.connection.on("error", (err) => {
        logger.error("Failed to connect to database", err);
        reject(err);
      });

      mongoose.connection.once("open", () => {
        logger.success("Connected to database");
        resolve();
      });
    });
  }
}
