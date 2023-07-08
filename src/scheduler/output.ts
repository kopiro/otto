import { isDocument } from "@typegoose/typegoose";
import { IOManager, OutputSource } from "../stdlib/io-manager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";

export default class OutputScheduler extends SchedulerRuntimeFunction {
  async run() {
    if (!isDocument(this.job.ioChannel)) {
      throw new Error("Invalid ioChannel");
    }
    if (!isDocument(this.job.person)) {
      throw new Error("Invalid Person");
    }
    const { programArgs, ioChannel, person } = this.job;
    return IOManager.getInstance().output(
      programArgs?.fulfillment,
      ioChannel,
      person,
      null,
      false,
      null,
      OutputSource.scheduler,
    );
  }
}
