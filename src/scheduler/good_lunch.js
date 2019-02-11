const TAG = 'Scheduler/GoodLunch';

exports.run = function({ session }) {
	return IOManager.outputByInputParams({ event: 'good_lunch' }, session);

};
