import config from "../config";

import { warmup } from "../boot";
import { Interaction } from "../data/interaction";

import { AIVectorMemory, MemoryType } from "../stdlib/ai/ai-vectormemory";
import { Signale } from "signale";

import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const TAG = "Memory";
const logger = new Signale({
  scope: TAG,
});

warmup()
  .then(async () => {
    const aiVectorMemory = AIVectorMemory.getInstance();
    const MEMORY_TYPE = (process.env.MEMORY_TYPE ?? "").split(",");

    if (!config().centralNode) {
      logger.warn("This script should only be run on the central node");
      // process.exit(1);
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
        const answer = await new Promise<string>((resolve) => {
          rl.question("Are you sure you want to erase episodic memory? (yes/no) ", (ans) => {
            resolve(ans);
          });
        });
        if (answer !== "yes") {
          logger.warn("Aborted");
          process.exit(0);
        }
        await aiVectorMemory.deleteCollection(MemoryType.episodic);
        const op = await Interaction.updateMany({}, { $unset: { reducedTo: true } });
        logger.success(`Erased reducedTo in interactions`, op);
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
