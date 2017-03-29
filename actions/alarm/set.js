exports.id = 'alarm.set';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const when = moment(
		(_.isEmpty(p.date) ? moment().format('YYYY-MM-DD') : p.date) + ' ' + p.time, 
		'YYYY-MM-DD HH:mm:ss'
		);
		const when_human = when.calendar();

		new Memory.Alarm({
			session_id: session_model.id,
			when: when.format('YYYY-MM-DD HH:mm:00')
		})
		.save()
		.then((contact) => {
			resolve({
				speech: fulfillment.speech.replace('$when', when_human)
			});
		})
		.catch(reject);
		
	});
};