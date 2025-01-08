import { isDocument } from "@typegoose/typegoose";
import { IOManager } from "../stdlib/io-manager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";
import { Input } from "../types";

export default class InputScheduler extends SchedulerRuntimeFunction {
  async run() {
    if (!isDocument(this.job.ioChannel)) {
      throw new Error("Invalid ioChannel");
    }

    if (!isDocument(this.job.person)) {
      throw new Error(`Invalid person for job: ${this.job._id}`);
    }

    const { programArgs, ioChannel, person } = this.job;
    return IOManager.getInstance().input(programArgs as Input, ioChannel, person, null);
  }
}
