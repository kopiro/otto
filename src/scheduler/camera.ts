import { output } from "../stdlib/iomanager";
import { SchedulerProgramClass } from "../stdlib/scheduler";
import takePhoto from "../packages/camera/take-photo";
import takeVideo from "../packages/camera/take-photo";

export default class CameraScheduler extends SchedulerProgramClass {
  async run() {
    let fulfillment;
    switch (this.job.programArgs?.type) {
      case "video":
        fulfillment = await takeVideo();
        break;
      case "photo":
      default:
        fulfillment = await takePhoto();
        break;
    }
    return output(fulfillment, this.job.session, {});
  }
}
