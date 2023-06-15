import { isDocument } from "@typegoose/typegoose";
import { IOManager } from "../stdlib/iomanager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";

export default class InputScheduler extends SchedulerRuntimeFunction {
  async run() {
    if (!isDocument(this.job.session)) {
      throw new Error("Invalid session");
    }

    const { programArgs, session } = this.job;
    return IOManager.getInstance().processInput(programArgs, session);
  }
}
