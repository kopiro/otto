import { IOManager } from "../stdlib/iomanager";
import { SchedulerRuntimeFunction } from "../stdlib/scheduler";

export default class OutputScheduler extends SchedulerRuntimeFunction {
  async run() {
    return IOManager.getInstance().output(this.job.programArgs?.fulfillment, this.job.session);
  }
}
