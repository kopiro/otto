const TAG = 'Cron';

const ALARM_STRINGS = [
"Hey {name}, sveglia!"
];

function tick() {
	config.ioDriversCron.forEach((io) => {
		tickPerIO(require(__basedir + '/io/' + io));
	});
}

function tickPerIO(IO) {
	const now = moment();
	console.info('Tick', 'WK=' + now.isoWeekday(), 'H=' + now.hours(), 'M=' + now.minutes());

	// Get standard messages
	Memory.Cron
	.query((qb) => {
		qb.where(Memory.__knex.raw('FIND_IN_SET(' + now.isoWeekday() + ', iso_weekday)'));
		qb.where(Memory.__knex.raw('FIND_IN_SET(' + now.hours() + ', hours)'));
		qb.where(Memory.__knex.raw('FIND_IN_SET(' + now.minutes() + ', minutes)'));
		qb.orderBy(Memory.__knex.raw('RAND()'));
		qb.limit(1);
	})
	.fetch({ require: true })
	.then((cron_row) => {
		IO.getChats()
		.then((chats) => {
			chats.forEach((chat) => {
				let text = cron_row.get('text');
				const contact = chat.related('contact');
				text = text.replace('{name}', contact.id ? contact.getName() : chat.getName());
				IO.output({
					data: chat.buildData(),
					params: {
						forceText: true,
						text: text
					}
				});
			});
		});
	})
	.catch(() => {});
	
	// Get alarms
	IO.getAlarmsAt( now.format('YYYY-MM-DD HH:mm:00') )
	.then((alarms) => {
		alarms.forEach((alarm) => {

			if (alarm.get('io_id')) {
				IO.getChat( alarm.get('io_id') )
				.then((chat) => {
					let text = ALARM_STRINGS.getRandom();
					const contact = chat.related('contact');
					text = text.replace('{name}', contact.id ? contact.getName() : chat.getName());

					IO.output({
						data: chat.buildData(),
						params: {
							forceText: true,
							text: text
						}
					})
					.then(() => {
						alarm.set('notified', true);
						alarm.save();
					});

				});
			} else {

			}

		});
	});
}

console.info(TAG, 'started');
setInterval(tick, 1000 * 60);
