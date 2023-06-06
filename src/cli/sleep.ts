import "../boot";
import { warmup } from "../boot";

import { LongTermMemoryReducer } from "../stdlib/ai/long-term-memory-reducer";

console.log("Sleeping...");

warmup()
  .then(async () => {
    await new LongTermMemoryReducer().reduce();
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
