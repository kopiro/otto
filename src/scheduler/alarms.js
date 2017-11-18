const TAG = 'Scheduler/Alarm';

const _ = require('underscore');
const moment = apprequire('moment');

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
			let text = ALARM_STRINGS.getRandom().replace('{name}', session_model.alias);

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