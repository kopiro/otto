import { warmup } from "../boot";
import config from "../config";
import { Interaction } from "../data/interaction";

import { AIVectorMemory, MemoryType } from "../stdlib/ai/ai-vectormemory";
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

    if (process.env.MEMORY_TYPE.includes(MemoryType.declarative)) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection(MemoryType.declarative);
      }
      await memory.buildDeclarativeMemory();
    }

    if (process.env.MEMORY_TYPE.includes(MemoryType.social)) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection(MemoryType.social);
      }
      await memory.buildSocialMemory();
    }

    if (process.env.MEMORY_TYPE.includes(MemoryType.episodic)) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection(MemoryType.episodic);
      }
      await memory.buildEpisodicMemory();
    }

    logger.info("Done");
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
