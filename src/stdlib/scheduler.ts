import Moment from "../lib/moment";
import * as Data from "../data";
import config from "../config";

const TAG = "Scheduler";
const FORMAT = "YYYY-MM-DD HH:mm:ss";

let started = false;

async function getJobs(time, conditions = []) {
  return Data.Scheduler.find({
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
      ...conditions,
    ],
  });
}

async function runJobs(jobs = []) {
  for (const job of jobs) {
    console.log(TAG, Date.now(), "running job", job);

    try {
      const programExecutable = (await import(`../scheduler/${job.programName}`)).default;
      const result = await programExecutable(job);
      console.debug(TAG, "processed", job, result);
    } catch (err) {
      console.error(TAG, "error", job, err);
    }
  }
}

async function tick() {
  const jobs = await getJobs(Moment());
  runJobs(jobs);
}

export async function start() {
  if (started) return;
  started = true;

  const jobs = await getJobs(Moment(), [{ onBoot: true }]);
  runJobs(jobs);

  console.info(TAG, "polling started");
  setInterval(tick, 1000);
}
