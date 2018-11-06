exports.id = 'alarm.set';

const _ = require('underscore');
const Moment = apprequire('moment');

module.exports = async function({ resultQuery }, session) {
	let { parameters: p, fulfillmentText } = resultQuery;

	let when = null;
	let now = Moment();

	if (!_.isEmpty(p.date) && !_.isEmpty(p.time)) {
		when = Moment(p.date + ' ' + p.time, 'YYYY-MM-DD HH:mm:ss');
	} else if (_.isEmpty(p.date) && !_.isEmpty(p.time)) {
		// If date is null, try to parse only the time
		// But if the time today is before now, postpone to tomorrow
		let time = Moment(
			now.format('YYYY-MM-DD') + ' ' + p.time,
			'YYYY-MM-DD HH:mm:ss'
		);
		if (time.isAfter(now)) {
			when = time;
		} else {
			when = time.add(1, 'days');
		}
	}

	if (when == null || !when.isValid()) {
		throw 'invalid_date';
	}

	if (when.unix() < Moment().unix()) {
		throw 'alarm_is_in_the_past';
	}

	const scheduling = new Data.Scheduler({
		session: session._id,
		manager_uid: config.uid,
		program: 'alarm',
		on_date: when.format('YYYY-MM-DD HH:mm:ss')
	});

	await scheduling.save();

	return fulfillmentText.replace('$when', when.calendar());
};
