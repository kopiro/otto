import { warmup } from "../boot";

import { AIVectorMemory } from "../stdlib/ai/ai-vectormemory";

process.env.MEMORY_TYPE = process.env.MEMORY_TYPE || "";

warmup()
  .then(async () => {
    const memory = AIVectorMemory.getInstance();

    if (process.env.MEMORY_TYPE.includes("episodic")) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection("episodic");
      }
      await memory.createEpisodicMemory();
    }
    if (process.env.MEMORY_TYPE.includes("declarative")) {
      if (process.env.ERASE) {
        await memory.deleteQdrantCollection("declarative");
      }
      await memory.createDeclarativeMemory();
    }

    console.info("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
