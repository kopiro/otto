import { isDocument } from "@typegoose/typegoose";
import { IOManager } from "../stdlib/io-manager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";

export default class OutputScheduler extends SchedulerRuntimeFunction {
  async run() {
    if (!isDocument(this.job.ioChannel)) {
      throw new Error("Invalid ioChannel");
    }
    const { programArgs, ioChannel, person } = this.job;
    return IOManager.getInstance().output(
      programArgs?.fulfillment,
      ioChannel,
      isDocument(person) ? person : null,
      null,
    );
  }
}
