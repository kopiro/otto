const TAG = 'Cron';

const ALARM_STRINGS = [
"Hey {name}, sveglia!"
];

function tick() {
	config.ioDriversCron.forEach((io) => {
		tickPerIO(require(__basedir + '/io/' + io));
	});
}

function tickPerIO(IO) {
	const now = moment();
	console.info('Tick', 'WK=' + now.isoWeekday(), 'H=' + now.hours(), 'M=' + now.minutes());

	// Get standard messages
	Memory.Cron
	.query((qb) => {
		qb.where(Memory.__knex.raw('FIND_IN_SET(' + now.isoWeekday() + ', iso_weekday)'));
		qb.where(Memory.__knex.raw('FIND_IN_SET(' + now.hours() + ', hours)'));
		qb.where(Memory.__knex.raw('FIND_IN_SET(' + now.minutes() + ', minutes)'));
		qb.orderBy(Memory.__knex.raw('RAND()'));
		qb.limit(1);
	})
	.then((cron_row) => {
		if (_.isEmpty(cron_row)) return;

		IOManager.getSessions( IO.id )
		.then((sessions) => {
			if (_.isEmpty(sessions)) return;

			console.log(sessions); return;

			sessions.forEach((session_model) => {
				const contact = session.related('contact');
				let text = cron_row.get('text').replace('{name}', contact.id ? contact.getName() : session_model.getName());
				IO.output({
					session_model: session_model,
					params: {
						speech: text
					}
				});
			});

		});
	});
	
	// Get alarms
	IO.getAlarmsAt( IO.id, now.format('YYYY-MM-DD HH:mm:00') )
	.then((alarms) => {
		if (_.isEmpty(alarms)) return;

		console.log(alarms); return;

		alarms.forEach((alarm) => {

			const session_model = alarm.related('session');
			const contact = session_model.related('contact');
			let text = ALARM_STRINGS.getRandom().replace('{name}', contact.id ? contact.getName() : chat.getName());

			IO.output({
				session_model: session_model,
				params: {
					speech: text
				}
			})
			.then(() => {
				alarm.set('notified', true);
				alarm.save();
			});
	
		});
	});
}

console.info(TAG, 'started with drivers => ' + config.ioDriversCron.join(', '));
setInterval(tick, 1000 * 60);