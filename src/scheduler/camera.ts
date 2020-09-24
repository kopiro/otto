import { output } from "../stdlib/iomanager";
import { SchedulerProgramClass } from "../stdlib/scheduler";
import takePhoto from "../packages/camera/take-photo";

export default class CameraScheduler extends SchedulerProgramClass {
  async run() {
    const fulfillment = await takePhoto();
    return output(fulfillment, this.job.session, {});
  }
}
