const Moment = require("../lib/moment");
const Data = require("../data");
const config = require("../config");

const TAG = "Scheduler";
const FORMAT = "YYYY-MM-DD HH:mm:ss";

let started = false;

async function getJobs(time) {
  return Data.Scheduler.find({
    manager_uid: config.uid,
    $or: [
      { yearly: time.format("DDD HH:mm:ss", { trim: false }) },
      { monthly: time.format("D HH:mm:ss", { trim: false }) },
      { weekly: time.format("d HH:mm:ss", { trim: false }) },
      { daily: time.format("HH:mm:ss", { trim: false }) },
      { hourly: time.format("mm:ss", { trim: false }) },
      { minutely: time.format("ss", { trim: false }) },
      { on_date: time.format(FORMAT) },
      { on_tick: true }
    ]
  });
}

async function getJobsOnBoot() {
  return Data.Scheduler.find({
    manager_uid: config.uid,
    on_boot: true
  });
}

async function runJobs(jobs) {
  if (jobs.length === 0) return;

  console.log(TAG, Date.now(), "Jobs to run", jobs);
  for (const job of jobs) {
    const program = require(`../scheduler/${job.program}`);
    try {
      const result = await program.run(job);
      console.debug(TAG, "processed", job, result);
    } catch (err) {
      console.error(TAG, "error", job, err);
    }
  }
}

async function tick() {
  const now = Moment();
  const jobs = await getJobs(now);
  runJobs(jobs);
}

async function startPolling() {
  if (started) return;
  started = true;

  const jobs = await getJobsOnBoot();
  runJobs(jobs);

  console.info(TAG, "polling started");
  setInterval(tick, 1000);
}

module.exports = {
  startPolling
};
