const TAG = 'Scheduler';

const _ = require('underscore');
const moment = apprequire('moment');

async function getScheduler(time) {
	return Data.Scheduler
	.find({
		client: require('os').hostname(),
		$or: [
		{ daily: (time.hours() + ':' + time.minutes()) },
		{ hourly: (time.minutes()) }
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
		console.debug(TAG, 'processing => ' + sch.name);
		
		const program = require(__basedir + '/src/scheduler/' + sch.name);
		program.run({
			session: sch.session
		});
	});
}

exports.startPolling = function() {
	console.log(TAG, 'started');
	tick();
};