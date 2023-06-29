import config from "../config";
import { Fulfillment } from "../types";
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

let started = false;

function flatDate(date: moment.Moment) {
  return date.seconds(0).milliseconds(0);
}

export async function scheduleFulfillment(fulfillment: Fulfillment, ioChannel: TIOChannel, date: Date) {
  return Scheduler.create({
    managerUid: config().uid,
    ioChannel: ioChannel.id,
    onDateISOString: flatDate(Moment()(date)).toISOString(),
    programName: "output",
    programArgs: { date, fulfillment },
    deleteAfterRun: true,
  });
}

async function getJobs(conditions: Partial<IScheduler>[] = []): Promise<TScheduler[]> {
  const time = flatDate(Moment()());

  const debugFormat = `DDD/D/d HH:mm:ss`;
  logger.debug(`Get Jobs: ${debugFormat}`, time.format(debugFormat));

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

async function getProgram(job: TScheduler): Promise<SchedulerRuntimeFunction> {
  switch (job.programName) {
    case "input":
      return new (await import("../scheduler/input")).default(job);
    case "output":
      return new (await import("../scheduler/output")).default(job);
    default:
      throw new Error(`Program <${job.programName}> not found`);
  }
}

async function runJob(job: TScheduler) {
  logger.debug(Date.now(), "running job", {
    programName: job.programName,
    programArgs: job.programArgs,
    ioChannel: job.ioChannel,
  });

  try {
    const program = await getProgram(job);
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

async function tick(conditions: Partial<IScheduler>[] = []) {
  const jobs = await getJobs(conditions);
  if (jobs.length > 0) {
    logger.debug("jobs", jobs);
  }
  jobs.forEach(runJob.bind(this));
}

export async function start() {
  if (started) {
    return;
  }

  started = true;

  logger.info(`Started (every ${EVERY_MS}ms)`);

  tick([{ onBoot: true }]);
  setInterval(tick.bind(this), EVERY_MS);
}
