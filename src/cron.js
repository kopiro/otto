const TAG = 'Cron';

const ALARM_STRINGS = [
"Hey {name}, sveglia!"
];

function tick() {
	setTimeout(tick, 60 * 1000);
	config.ioDriversCron.forEach((io_id) => {
		tickPerIO(IOManager.getDriver(io_id, true));
	});
}

function tickPerIO(IO) {
	const now = moment();
	console.info(TAG, 'WK=' + now.isoWeekday(), 'H=' + now.hours(), 'M=' + now.minutes());

	Data.Cron
	.findOne()
	.then((cron_row) => {

		Data.Session
		.find()
		.populate('contact')
		.then((sessions) => {
			if (_.isEmpty(sessions)) return;

			sessions.forEach((session_model) => {
				const text = cron_row.text.replace('{name}', session_model.contact.name);

				IOManager.output({ speech: text }, session_model)
				.catch((err) => {
					console.error(TAG, IO.id, err);
				});
			});

		});
	});
	
	// Get alarms
	IOManager.getAlarmsAt( IO.id, now.format('YYYY-MM-DD HH:mm:00') )
	.then((alarms) => {
		if (_.isEmpty(alarms)) return;
		alarms.forEach((alarm) => {

			const session_model = alarm.related('session');
			const contact = session_model.related('contact');
			let text = ALARM_STRINGS.getRandom().replace('{name}', contact.id ? contact.name : session_model.name);

			IOManager.output({ speech: text }, session_model)
			.then(() => {
				alarm.set('notified', true);
				alarm.save();
			})
			.catch((err) => {
				console.error(TAG, IO.id, err);
			});
		
		});
	});
}

console.info(TAG, 'started with drivers => ' + config.ioDriversCron.join(', '));
tick();