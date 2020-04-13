import * as AI from "../stdlib/ai";
import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class InputScheduler extends SchedulerProgramClass {
  async run() {
    return AI.processInput(this.job.programArgs, this.job.session);
  }
}
