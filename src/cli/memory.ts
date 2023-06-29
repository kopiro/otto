import { warmup } from "../boot";
import config from "../config";

import { AIVectorMemory } from "../stdlib/ai/ai-vectormemory";
import { Signale } from "signale";

const TAG = "Memory";
const logger = new Signale({
  scope: TAG,
});

process.env.MEMORY_TYPE = process.env.MEMORY_TYPE || "";

warmup()
  .then(async () => {
    if (!config().centralNode) {
      logger.error("This script should only be run on the central node");
      process.exit(1);
    }

    const memory = AIVectorMemory.getInstance();

    if (process.env.MEMORY_TYPE.includes("declarative")) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection("declarative");
      }
      await memory.createDeclarativeMemory();
    }

    if (process.env.MEMORY_TYPE.includes("episodic")) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection("episodic");
      }
      await memory.createEpisodicMemory();
    }

    logger.info("Done");
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
