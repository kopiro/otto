const TAG = 'Scheduler';

const _ = require('underscore');
const Moment = apprequire('moment');

const FORMAT = 'YYYY-MM-DD HH:mm:ss';

let started = false;

async function getScheduler(time) {
	return Data.Scheduler
	.find({
		manager_uid: config.uid,
		$or: [
		{ yearly: time.format('DDD HH:mm:ss', { trim: false }) },
		{ monthly: time.format('D HH:mm:ss', { trim: false }) },
		{ weekly: time.format('d HH:mm:ss', { trim: false }) },
		{ daily: time.format('HH:mm:ss', { trim: false }) },
		{ hourly: time.format('mm:ss', { trim: false }) },
		{ minutely: time.format('ss', { trim: false }) },
		{ on_date: time.format(FORMAT) },
		{ on_tick: true }
		]
	});
}

async function tick() {
	const now = Moment();
	
	const data = await getScheduler(now);
	if (_.isEmpty(data)) return;

	console.log(TAG, data);

	data.forEach((sch) => {
		console.debug(TAG, 'processing => ' + sch.program);
		const program = require(__basedir + '/src/scheduler/' + sch.program);
		program.run(sch);
	});
}

exports.startPolling = function() {
	if (started) return;
	started = true;

	console.info(TAG, 'polling started');
	tick();
	setInterval(tick, 1000);
};