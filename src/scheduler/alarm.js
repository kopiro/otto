const TAG = 'Scheduler/Alarm';
const Moment = apprequire('moment');

exports.run = function(e) {
	const now = Moment();

	if (e.program_data != null) {
		return IOManager.input({
			session: e.session,
			params: {
				event: {
					name: 'alarm_speech',
					data: e.program_data
				}
			}
		});	
	}

	return IOManager.input({
		session: e.session,
		params: {
			event: 'alarm'
		}
	});	
};