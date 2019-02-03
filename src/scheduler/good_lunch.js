const TAG = 'Scheduler/GoodLunch';

exports.run = function({ session }) {
	return IOManager.outputByInputParams(
		{
			event: {
				name: 'good_lunch'
			}
		}, session);
};
