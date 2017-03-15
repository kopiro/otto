const TAG = path.basename(__filename, '.js');

module.exports = function(e, { io, data }) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment } = e;

		const when = moment((p.date || moment().format('YYYY-MM-DD')) + ' ' + p.time, 'YYYY-MM-DD HH:ii:ss');

		new Memory.Alarm({
			io: io.id,
			chat_id: data.chatId,
			when: when.format('YYYY-MM-DD HH:ii:ss')
		})
		.save()
		.then((contact) => {
			const when_human = when.calendar();
			resolve({
				text: [
					`Perfetto, ti sveglierò il ${when_human}`,
					`D'accord, ci sentiamo il ${when_human}`
				].getRandom()
			});
		})
		.catch(reject);
		
	});
};

