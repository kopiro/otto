import * as Data from "../data";
import config from "../config";
import { Fulfillment, Scheduler as SchedulerModel, Session } from "../types";
import moment from "../lib/moment";
import { Signale } from "signale";

const TAG = "Scheduler";
const console = new Signale({
  scope: TAG,
});

const FORMAT = "YYYY-MM-DD HH:mm:ss";

export type SchedulerProgramName = "input";

export abstract class SchedulerProgramClass {
  job: SchedulerModel;
  constructor(job: SchedulerModel) {
    this.job = job;
  }
  abstract run();
}

type SchedulerConfig = { uid: string };
export class Scheduler {
  private started = false;
  private _config: SchedulerConfig;

  constructor(_config: SchedulerConfig) {
    this._config = _config;
  }

  getManagerUid(): string {
    return this._config.uid;
  }

  flatDate(date: moment.Moment) {
    return date.seconds(0).milliseconds(0);
  }

  async scheduleFulfillment(fulfillment: Fulfillment, session: Session, date: Date) {
    const job = new Data.Scheduler({
      managerUid: this.getManagerUid(),
      session: session.id,
      onDateISOString: this.flatDate(moment()(date)).toISOString(),
      programName: "output",
      programArgs: { date, fulfillment },
      deleteAfterRun: true,
    });
    console.debug("scheduled fulfillment", job);
    return job.save();
  }

  async getJobs(conditions = []): Promise<SchedulerModel[]> {
    const time = this.flatDate(moment()());
    const query = [
      { yearly: time.format("DDD HH:mm:ss") },
      { monthly: time.format("D HH:mm:ss") },
      { weekly: time.format("d HH:mm:ss") },
      { daily: time.format("HH:mm:ss") },
      { hourly: time.format("mm:ss") },
      { minutely: time.format("ss") },
      { everyHalfHour: +time.format("m") % 30 === 0 },
      { everyQuartelyHour: +time.format("m") % 15 === 0 },
      { everyFiveMinutes: +time.format("m") % 5 === 0 },
      { onDate: time.format(FORMAT) },
      { onDateISOString: time.toISOString() },
      { onTick: true },
      ...conditions,
    ];
    const jobs = await Data.Scheduler.find({
      managerUid: this.getManagerUid(),
      $or: query,
    });
    return jobs;
  }

  async getProgram(job: SchedulerModel): Promise<SchedulerProgramClass> {
    switch (job.programName) {
      case "input":
        return new (await import("../scheduler/input")).default(job);
      case "output":
        return new (await import("../scheduler/output")).default(job);
      case "camera":
        return new (await import("../scheduler/camera")).default(job);
      case "countdown":
        return new (await import("../scheduler/countdown")).default(job);
    }
  }

  async runJob(job: SchedulerModel) {
    console.debug(Date.now(), "running job", {
      programName: job.programName,
      programArgs: job.programArgs,
      "session.id": job.session.id,
    });

    try {
      const program = await this.getProgram(job);
      if (!program) {
        throw new Error(`Program <${job.programName}> not found`);
      }

      const result = await program.run();
      console.debug("processed", result);

      if (job.deleteAfterRun) {
        job.delete();
      }

      return result;
    } catch (err) {
      console.error("error", err);
    }
  }

  async tick(conditions = []) {
    const jobs = await this.getJobs(conditions);
    if (jobs.length > 0) {
      console.debug("jobs", jobs);
    }
    jobs.forEach(this.runJob.bind(this));
  }

  async start() {
    if (this.started) {
      console.warn("attempted to start an already started instance");
      return;
    }

    this.started = true;

    console.info(`polling started`);

    this.tick([{ onBoot: true }]);
    setInterval(this.tick.bind(this), 60 * 1000);
  }
}

let _instance: Scheduler;
export default (): Scheduler => {
  _instance = _instance || new Scheduler(config());
  return _instance;
};
