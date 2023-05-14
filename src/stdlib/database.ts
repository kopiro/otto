import mongoose from "mongoose";
import config from "../config";

export function getUrl() {
  const { user, password, host, port, database } = config().mongo;
  return `mongodb://${user}:${password}@${host}:${port}/${database}`;
}

export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    mongoose.connect(getUrl());
    mongoose.connection.on("error", reject);
    mongoose.connection.once("open", resolve);
  });
}
