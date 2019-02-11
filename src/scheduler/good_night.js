const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	return IOManager.outputByInputParams({ event: 'good_morning' }, session);
};
