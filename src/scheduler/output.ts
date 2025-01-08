import { isDocument } from "@typegoose/typegoose";
import { IOManager, OutputSource } from "../stdlib/io-manager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";

export default class OutputScheduler extends SchedulerRuntimeFunction {
  async run() {
    if (!isDocument(this.job.ioChannel)) {
      throw new Error(`Invalid ioChannel for job: ${this.job._id}`);
    }
    if (!isDocument(this.job.person)) {
      throw new Error(`Invalid person for job: ${this.job._id}`);
    }
    const { programArgs, ioChannel, person } = this.job;
    return IOManager.getInstance().output(programArgs?.output, ioChannel, person, null, null, OutputSource.scheduler);
  }
}
