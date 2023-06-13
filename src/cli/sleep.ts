import "../boot";
import { warmup } from "../boot";

import { LongTermMemoryReducer } from "../stdlib/ai/long-term-memory-reducer";

console.info("Sleeping...");

warmup()
  .then(async () => {
    await new LongTermMemoryReducer().reduce();
    console.info("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
