import "./boot";
import { program } from "commander";
import * as IOManager from "./stdlib/iomanager";
import AI from "./stdlib/ai";
import "./boot";

program
  .command("output")
  .option("-s, --sessionId <number>", "Session")
  .option("-t, --text <value>", "Text")
  .description("send a message")
  .action(async ({ sessionId, text }) => {
    try {
      const session = await IOManager.getSession(sessionId);
      if (!session) throw new Error("Unable to find session");
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
  .option("-s, --sessionId <number>", "Session")
  .option("-t, --text <value>", "Text")
  .description("send a message")
  .action(async ({ sessionId, text }) => {
    try {
      const session = await IOManager.getSession(sessionId);
      if (!session) throw new Error("Unable to find session");
      const result = await AI.processInput({ text }, session);
      console.log(result);
    } catch (err) {
      console.error(err);
    } finally {
      process.exit();
    }
  });

program.parse(process.argv);
