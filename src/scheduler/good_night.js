const TAG = 'Scheduler/GoodMorning';

exports.run = function({ session }) {
	IOManager.input({
		session_model: session,
		params: {
			fulfillment: { 
				speech: 'Ehi, hai visto che ore sono?! Secondo me dovremmo andare a dormire'
			}
		}
	});
};