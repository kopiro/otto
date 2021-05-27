import moment from "../lib/moment";
import ai from "../stdlib/ai";

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

    return ai().processInput(
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
