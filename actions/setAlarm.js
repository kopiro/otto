module.exports = function(request) {
	console.info('AI.setAlarm', JSON.stringify(request));
	
	return new Promise(function(resolve, reject) {

		var when = moment(request.entities.datetime[0].value);
		if (when.diff(moment()) < 0) {
			reject({
				text: "Non posso ancora andare indietro nel tempo"
			});
			return;
		}

		var when_human = when.calendar();

		resolve({
			alarmTime: when_human
		});
	});
};