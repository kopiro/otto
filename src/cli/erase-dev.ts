import { warmup } from "../boot";
import { Interaction } from "../data/interaction";
import { Signale } from "signale";

const TAG = "Memory";
const logger = new Signale({
  scope: TAG,
});

warmup().then(async () => {
  const op = await Interaction.deleteMany({
    managerUid: "ottodev",
  });
  logger.success(op);
  process.exit();
});
