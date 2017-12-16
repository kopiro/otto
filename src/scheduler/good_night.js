const TAG = 'Scheduler/GoodNight';

exports.run = function({ session }) {
	return IOManager.input({
		session: session,
		params: {
			event: 'good_night'
		}
	});
};