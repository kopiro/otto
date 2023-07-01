import mongoose from "mongoose";
import config from "../config";

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
    return `mongodb://${user}:${password}@${host}:${port}/${database}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      mongoose.connect(this.getUrl());
      mongoose.connection.on("error", reject);
      mongoose.connection.once("open", resolve);
    });
  }
}
