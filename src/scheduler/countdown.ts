import moment from "../lib/moment";
import { AIDirector } from "../stdlib/ai/director";

import { SchedulerProgramClass } from "../stdlib/scheduler";

export default class CountdownScheduler extends SchedulerProgramClass {
  async run() {
    const { date, name, eventName } = this.job.programArgs;
    const momentDate = moment()(date);
    if (new Date() > momentDate.toDate()) {
      return;
    }

    const time = momentDate.fromNow();
    const timeNoSuffix = momentDate.fromNow(true);

    return AIDirector.getInstance().processInput(
      {
        event: {
          name: eventName,
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
