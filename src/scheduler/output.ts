import { isDocument } from "@typegoose/typegoose";
import { IOManager } from "../stdlib/iomanager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";

export default class OutputScheduler extends SchedulerRuntimeFunction {
  async run() {
    if (!isDocument(this.job.session)) {
      throw new Error("Session is not a document");
    }
    return IOManager.getInstance().output(this.job.programArgs?.fulfillment, this.job.session);
  }
}
