const TAG = 'Scheduler/HourAnnunce';

const moment = apprequire('moment');

exports.run = function({ session }) {
	const now = moment();

	IOManager.output({ 
		speech: 'Sono le ' + now.hours() 
	}, session);
};