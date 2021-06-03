import { output } from "../stdlib/iomanager";
import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class OutputScheduler extends SchedulerProgramClass {
  async run() {
    return output(this.job.programArgs?.fulfillment, this.job.session);
  }
}
