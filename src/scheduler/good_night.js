const TAG = 'Scheduler/GoodNight';

exports.run = function({ session }) {
	return IOManager.hanle({
		session: session,
		params: {
			event: 'good_night'
		}
	});
};