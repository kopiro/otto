import Moment from "../lib/moment";
import * as Data from "../data";
import config from "../config";
import { Scheduler as SchedulerModel } from "../types";

const TAG = "Scheduler";
const FORMAT = "YYYY-MM-DD HH:mm:ss";

export type SchedulerProgramName = "input";

export abstract class SchedulerProgramClass {
  job: SchedulerModel;
  constructor(job: SchedulerModel) {
    this.job = job;
  }
  abstract async run();
}

export class Scheduler {
  started = false;

  async getJobs(time, conditions = []): Promise<SchedulerModel[]> {
    const jobs = await Data.Scheduler.find({
      managerUid: config().uid,
      $or: [
        { yearly: time.format("DDD HH:mm:ss", { trim: false }) },
        { monthly: time.format("D HH:mm:ss", { trim: false }) },
        { weekly: time.format("d HH:mm:ss", { trim: false }) },
        { daily: time.format("HH:mm:ss", { trim: false }) },
        { hourly: time.format("mm:ss", { trim: false }) },
        { minutely: time.format("ss", { trim: false }) },
        { onDate: time.format(FORMAT) },
        { onTick: true },
        { dailyRandom: true },
        ...conditions,
      ],
    });
    return jobs;
  }

  async getProgram(job: SchedulerModel): Promise<SchedulerProgramClass> {
    switch (job.programName) {
      case "input":
        return new (await import("../scheduler/input")).default(job);
      case "countdown":
        return new (await import("../scheduler/countdown")).default(job);
    }
  }

  async runJob(job: SchedulerModel) {
    console.log(TAG, Date.now(), "running job", {
      programName: job.programName,
      programArgs: job.programArgs,
      "session.id": job.session.id,
    });

    try {
      const program = await this.getProgram(job);
      const result = await program.run();
      console.debug(TAG, "processed", result);
      return result;
    } catch (err) {
      console.error(TAG, "error", err);
    }
  }

  async tick() {
    const jobs = await this.getJobs(Moment());
    jobs.forEach(this.runJob.bind(this));
  }

  async start() {
    if (this.started) {
      console.warn(TAG, "attempted to start an already started instance");
      return;
    }

    this.started = true;

    const jobs = await this.getJobs(Moment(), [{ onBoot: true }]);
    jobs.forEach(this.runJob.bind(this));

    console.info(TAG, "polling started");
    setInterval(this.tick.bind(this), 1000);
  }
}

export default new Scheduler();
