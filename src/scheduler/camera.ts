import { output } from "../stdlib/iomanager";
import { SchedulerProgramClass } from "../stdlib/scheduler";
import camera from "../stdlib/camera";

export default class CameraScheduler extends SchedulerProgramClass {
  async run() {
    let fulfillment;
    switch (this.job.programArgs?.type) {
      case "video":
        fulfillment = { image: await camera().takeVideo() };
        break;
      case "photo":
      default:
        fulfillment = { video: await camera().takePhoto() };
        break;
    }
    return output(fulfillment, this.job.session, {});
  }
}
