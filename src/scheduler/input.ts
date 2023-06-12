import { AIDirector } from "../stdlib/ai/director";
import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class InputScheduler extends SchedulerProgramClass {
  async run() {
    return AIDirector.getInstance().processInput(this.job.programArgs, this.job.session);
  }
}
