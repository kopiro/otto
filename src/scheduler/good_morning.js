const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	IOManager.input({ 
		params: { fulfillment: {
			speech: 'Buongiorno! Sono le ' + now.hours() + ' e ' + now.minutes() + '; penso sia ora di svegliarsi!' 
		} },
		session_model: session
	});
};