const TAG = 'Scheduler/HourAnnunce';

exports.run = function({ session }) {
	const now = moment();

	IOManager.output({ 
		speech: 'Sono le ' + now.hours() 
	}, session);
};