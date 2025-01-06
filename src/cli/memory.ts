import { warmup } from "../boot";
import config from "../config";
import { Interaction } from "../data/interaction";

import { AIVectorMemory, MemoryType } from "../stdlib/ai/ai-vectormemory";
import { Signale } from "signale";

const TAG = "Memory";
const logger = new Signale({
  scope: TAG,
});

warmup()
  .then(async () => {
    const memory = AIVectorMemory.getInstance();
    const MEMORY_TYPE = (process.env.MEMORY_TYPE ?? "").split(",");

    if (!config().centralNode) {
      logger.warn("This script should only be run on the central node");
      process.exit(1);
    }

    if (MEMORY_TYPE.includes(MemoryType.declarative)) {
      await memory.buildDeclarativeMemory();
    }

    if (MEMORY_TYPE.includes(MemoryType.social)) {
      await memory.buildSocialMemory();
    }

    if (MEMORY_TYPE.includes(MemoryType.episodic)) {
      if (process.env.REBUILD_MEMORY) {
        await memory.deleteCollection(MemoryType.episodic);
        // Set all reducedTo to false in interactions
        const op = await Interaction.updateMany({}, { $unset: { reducedTo: true } });
        logger.success(`Erased reducedTo in interactions`, op);
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
