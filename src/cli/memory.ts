import config from "../config";

import { warmup } from "../boot";
import { Interaction } from "../data/interaction";

import { AIVectorMemory, MemoryType } from "../stdlib/ai/ai-vectormemory";
import { Signale } from "signale";

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = readline.createInterface({ input: stdin, output: stdout });

const TAG = "Memory";
const logger = new Signale({
  scope: TAG,
});

warmup()
  .then(async () => {
    const aiVectorMemory = AIVectorMemory.getInstance();
    const MEMORY_TYPE = (process.env.MEMORY_TYPE ?? "").split(",");

    if (!config().centralNode) {
      if (process.env.INTERACTIVE) {
        if (
          (await rl.question("This script should only be run on the central node, do you want to continue (y/n)? ")) !==
          "y"
        ) {
          logger.warn("Aborted");
          process.exit(0);
        }
      }
    }

    if (MEMORY_TYPE.includes(MemoryType.declarative)) {
      await aiVectorMemory.buildDeclarativeMemory();
    }

    if (MEMORY_TYPE.includes(MemoryType.social)) {
      await aiVectorMemory.buildSocialMemory();
    }

    if (MEMORY_TYPE.includes(MemoryType.episodic)) {
      if (process.env.REBUILD_MEMORY) {
        // Ask for confirmation with readline
        if ((await rl.question("Are you sure you want to erase episodic memory (y/n)? ")) !== "y") {
          logger.warn("Aborted");
          process.exit(0);
        }

        const op1 = await aiVectorMemory.deleteCollection(MemoryType.episodic);
        logger.success(`Deleted episodic memory`, op1);

        const op2 = await Interaction.updateMany({}, { $unset: { reducedTo: true } });
        logger.success(`Erased reducedTo in interactions`, op2);
      }
      await aiVectorMemory.buildEpisodicMemory();
    }

    logger.info("Done");
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
