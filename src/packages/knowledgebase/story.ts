import { AIAction } from "../../types";
import { Storage } from "@google-cloud/storage";
import config from "../../config";

const main: AIAction = async function (): Promise<string> {
  const bucket = new Storage().bucket((config().gcloud.storage.bucket as unknown) as string);

  let [files] = await bucket.getFiles({ prefix: "stories/" });
  files = files.filter((file) => /\.txt$/.test(file.name));
  const chosenFile = files[Math.floor(Math.random() * (files.length - 1))];

  const [content] = await chosenFile.download();
  return content.toString("utf8");
};

export default main;
