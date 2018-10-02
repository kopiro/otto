const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	return IOManager.handle({
		session: session,
		params: {
			event: 'good_morning'
		}
	});
};