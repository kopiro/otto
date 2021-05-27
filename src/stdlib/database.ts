import mongoose from "mongoose";
import config from "../config";

function getUrl() {
  return `mongodb://${config().mongo.user}:${config().mongo.password}@${config().mongo.host}:${config().mongo.port}/${
    config().mongo.database
  }`;
}

export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    mongoose.connect(getUrl(), { useNewUrlParser: true, useUnifiedTopology: true });
    mongoose.connection.on("error", reject);
    mongoose.connection.once("open", resolve);
  });
}
