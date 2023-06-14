import { AIManager } from "../stdlib/ai/ai-manager";
import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class InputScheduler extends SchedulerProgramClass {
  async run() {
    return AIManager.getInstance().processInput(this.job.programArgs, this.job.session);
  }
}
