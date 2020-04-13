import { program } from "commander";
import config from "./config";
import * as IOManager from "./stdlib/iomanager";
import * as AI from "./stdlib/ai";
import "./boot";

program
  .command("output")
  .option("-d, --driverId <string>", "Driver")
  .option("-s, --sessionId <number>", "Session")
  .option("-t, --text <value>", "Text")
  .description("send a message")
  .action(async ({ driverId, sessionId, text }) => {
    try {
      const session = await IOManager.getSessionByParts(config().uid, driverId, sessionId);
      const result = await IOManager.output({ fulfillmentText: text }, session, {}, true);
      console.log(result);
    } catch (err) {
      console.error(err);
    } finally {
      process.exit();
    }
  });

program
  .command("input")
  .option("-d, --driverId <string>", "Driver")
  .option("-s, --sessionId <number>", "Session")
  .option("-t, --text <value>", "Text")
  .description("send a message")
  .action(async ({ driverId, sessionId, text }) => {
    try {
      const session = await IOManager.getSessionByParts(config().uid, driverId, sessionId);
      const result = await AI.processInput({ text }, session);
      console.log(result);
    } catch (err) {
      console.error(err);
    } finally {
      process.exit();
    }
  });

program.parse(process.argv);
