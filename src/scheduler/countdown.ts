import AI from "../stdlib/ai";
import Moment from "../lib/moment";

import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class CountdownScheduler extends SchedulerProgramClass {
  async run() {
    const { date, name } = this.job.programArgs;
    const momentDate = Moment(date);
    const time = momentDate.fromNow();
    const timeNoSuffix = momentDate.fromNow(true);
    return AI.processInput(
      {
        event: {
          name: "countdown",
          parameters: {
            time,
            timeNoSuffix,
            name,
          },
        },
      },
      this.job.session,
    );
  }
}
