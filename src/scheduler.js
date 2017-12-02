const TAG = 'Scheduler';

const _ = require('underscore');
const moment = apprequire('moment');

async function getScheduler(time) {
	return Data.Scheduler
	.find({
		manager_uid: config.uid,
		$or: [
		{ daily: (time.hours() + ':' + time.minutes()) },
		{ hourly: (time.minutes()) },
		{ on_tick: true }
		]
	}) 
	.populate('session');
}

async function tick() {
	setTimeout(tick, 60 * 1000);

	const now = moment();
	console.debug(TAG, 'tick', now.hours() + ':' + now.minutes());

	const data = await getScheduler(now);
	if (_.isEmpty(data)) return;

	console.log(data);

	data.forEach((sch) => {
		console.debug(TAG, 'processing => ' + sch.program);
		const program = require(__basedir + '/src/scheduler/' + sch.program);
		program.run({
			session: sch.session
		});
	});
}

exports.startPolling = function() {
	console.log(TAG, 'started');
	tick();
};