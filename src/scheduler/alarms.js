const TAG = 'Scheduler/Alarm';

const ALARM_STRINGS = [
"Hey {name}, sveglia!"
];

exports.run = function() {
	const now = moment();

	IOManager.getAlarmsAt(now.format('YYYY-MM-DD HH:mm:00'))
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