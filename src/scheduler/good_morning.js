const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	return IOManager.outputByInputParams({
		event: {
			name: 'good_morning'
		}
	}, session);
};
