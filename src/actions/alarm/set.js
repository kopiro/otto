exports.id = 'alarm.set';

const _ = require('underscore');
const moment = apprequire('moment');

module.exports = function({ sessionId, result }, session) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const when = moment(
		(_.isEmpty(p.date) ? moment().format('YYYY-MM-DD') : p.date) + ' ' + p.time, 
		'YYYY-MM-DD HH:mm:ss'
		);

		if (false == when.isValid()) {
			return reject({
				speech: "Non riesco a capire quando mettere la sveglia."
			});
		}

		if (when.unix() < moment().unix()) {
			return reject({
				speech: "Non posso ancora andare indietro nel tempo!"
			});
		}

		const when_human = when.calendar();

		new Data.Alarm({
			session: session._id,
			when: when.toDate()
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