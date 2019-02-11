const TAG = 'Scheduler/GoodNight';

exports.run = function({ session }) {
	return IOManager.outputByInputParams({ event: 'good_night' }, session);
};
