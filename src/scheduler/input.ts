import ai from "../stdlib/ai";
import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class InputScheduler extends SchedulerProgramClass {
  async run() {
    return ai().processInput(this.job.programArgs, this.job.session);
  }
}
