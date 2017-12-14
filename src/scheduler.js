const TAG = 'Scheduler';

const _ = require('underscore');
const Moment = apprequire('moment');

let started = false;

async function getScheduler(time) {
	return Data.Scheduler
	.find({
		manager_uid: config.uid,
		$or: [
		{ daily: time.format('HH:mm', { trim: false }) },
		{ hourly: time.format('mm', { trim: false }) },
		{ on_tick: true }
		]
	}) 
	.populate('session');
}

async function tick() {
	const now = Moment();
	console.debug(TAG, 'tick', now.format('YYYY-MM-DD HH:mm:ss', {trim:false}));

	const data = await getScheduler(now);
	if (_.isEmpty(data)) return;

	console.log(TAG, data);

	data.forEach((sch) => {
		console.debug(TAG, 'processing => ' + sch.program);
		const program = require(__basedir + '/src/scheduler/' + sch.program);
		program.run({
			session: sch.session
		});
	});
}

exports.startPolling = function() {
	if (started) return;
	started = true;

	console.info(TAG, 'polling started');
	tick();
	setInterval(tick, 60 * 1000);
};