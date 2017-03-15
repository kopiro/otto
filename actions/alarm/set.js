const TAG = path.basename(__filename, '.js');

module.exports = function(e, { io, data }) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment } = e;

		const when = moment((p.date || moment().format('YYYY-MM-DD')) + ' ' + p.time, 'YYYY-MM-DD HH:mm:ss');

		new Memory.Alarm({
			io: io.id,
			io_id: data.ioId,
			when: when.format('YYYY-MM-DD HH:mm:00')
		})
		.save()
		.then((contact) => {
			const when_human = when.calendar();
			resolve({
				text: [
					`Perfetto, ti sveglierò ${when_human}`,
					`D'accord, ci sentiamo ${when_human}`
				].getRandom()
			});
		})
		.catch(reject);
		
	});
};

