const TAG = 'Scheduler/HourAnnunce';

const moment = apprequire('moment');

exports.run = function({ session }) {
	const now = moment();
	if (now.hours() >= 10 && now.hours() <= 23) {
		IOManager.output({ 
			speech: 'Sono le ' + now.hours() + ' e ' + now.minutes()
		}, session);
	}
};