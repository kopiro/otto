const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	return IOManager.outputByParams(
		{
			event: {
				name: 'good_night'
			}
		}, session);
};
