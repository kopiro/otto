const TAG = 'Scheduler/GoodNight';

exports.run = function ({
	session
}) {
	return IOManager.handle({
		session: session,
		params: {
			event: 'good_night'
		}
	});
};