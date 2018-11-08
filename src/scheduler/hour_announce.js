const TAG = 'Scheduler/HourAnnunce';

const Moment = apprequire('moment');

exports.run = function({ session }) {
	const now = Moment();
	if (now.hours() >= 10 && now.hours() <= 23) {
		return IOManager.outputByParams({
			event: {
				name: 'hour_announce'
			}, session);
	}
};