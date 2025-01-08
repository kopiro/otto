import config from "../config";
import { Output } from "../types";
import { Moment } from "../lib/moment";
import { Signale } from "signale";
import { IScheduler, Scheduler, TScheduler } from "../data/scheduler";
import { TIOChannel } from "../data/io-channel";

const TAG = "Scheduler";
const logger = new Signale({
  scope: TAG,
});

const FORMAT = "YYYY-MM-DD HH:mm:ss";
const EVERY_MS = 60 * 1000;

export type SchedulerProgramName = "input";

export abstract class SchedulerRuntimeFunction {
  constructor(public job: TScheduler) {}
  abstract run(): any;
}

export class SchedulerManager {
  started = false;

  private static instance: SchedulerManager;
  public static getInstance(): SchedulerManager {
    if (!SchedulerManager.instance) {
      SchedulerManager.instance = new SchedulerManager();
    }
    return SchedulerManager.instance;
  }

  flatDate(date: moment.Moment) {
    return date.seconds(0).milliseconds(0);
  }

  async scheduleOutput(output: Output, ioChannel: TIOChannel, date: Date) {
    return Scheduler.create({
      managerUid: config().uid,
      ioChannel: ioChannel.id,
      onDateISOString: this.flatDate(Moment()(date)).toISOString(),
      programName: "output",
      programArgs: { date, output },
      deleteAfterRun: true,
    });
  }

  async getJobs(conditions: Partial<IScheduler>[] = []): Promise<TScheduler[]> {
    const time = this.flatDate(Moment()());

    const query = [
      { yearly: time.format("DDD HH:mm:ss") },
      { monthly: time.format("D HH:mm:ss") },
      { weekly: time.format("d HH:mm:ss") },
      { daily: time.format("HH:mm:ss") },
      { hourly: time.format("mm:ss") },
      { minutely: time.format("ss") },
      { everyHalfHour: Number(time.format("m")) % 30 === 0 },
      { everyQuartelyHour: Number(time.format("m")) % 15 === 0 },
      { everyFiveMinutes: Number(time.format("m")) % 5 === 0 },
      { onDate: time.format(FORMAT) },
      { onDateISOString: time.toISOString() },
      { onTick: true },
      ...conditions,
    ];
    const jobs = await Scheduler.find({
      managerUid: config().uid,
      $or: query,
    });
    return jobs;
  }

  async getProgram(job: TScheduler): Promise<SchedulerRuntimeFunction> {
    switch (job.programName) {
      case "input":
        return new (await import("../scheduler/input")).default(job);
      case "output":
        return new (await import("../scheduler/output")).default(job);
      default:
        throw new Error(`Program <${job.programName}> not found`);
    }
  }

  async runJob(job: TScheduler) {
    logger.debug(Date.now(), "running job", {
      programName: job.programName,
      programArgs: job.programArgs,
      ioChannel: job.ioChannel,
    });

    try {
      const program = await this.getProgram(job);
      if (!program) {
        throw new Error(`Program <${job.programName}> not found`);
      }

      const result = await program.run();
      logger.debug("processed", result);

      if (job.deleteAfterRun) {
        await Scheduler.findByIdAndDelete(job.id);
      }

      return result;
    } catch (err) {
      logger.error("error", err);
    }
  }

  async tick(conditions: Partial<IScheduler>[] = []) {
    const jobs = await this.getJobs(conditions);
    if (jobs.length > 0) {
      logger.debug("jobs", jobs);
    }
    jobs.forEach(this.runJob.bind(this));
  }

  async start() {
    if (this.started) {
      return;
    }

    this.started = true;

    logger.success(`Started (every ${EVERY_MS}ms)`);

    this.tick([{ onBoot: true }]);
    setInterval(this.tick.bind(this), EVERY_MS);
  }
}
