const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	return IOManager.input({
		session: session,
		params: {
			event: 'good_morning'
		}
	});
};