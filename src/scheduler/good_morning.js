const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	const now = moment();

	IOManager.output({ 
		speech: 'Buongiorno! Sono le ' + now.hours() + ' e ' + now.minutes() + '; penso sia ora di svegliarsi!' 
	}, session);
};