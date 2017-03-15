const ALARM_STRINGS = [
"Hey {name}, sveglia!"
];

const CRON_IN_DAYS = [
	{
		isoWeekday: [1,2,3,4,5,6],
		hours: 23,
		minutes: function() { return _.random(0, 59); },
		text: [
			"E' stato bello stare insieme, ora vado a letto! Buonanotte <3",
			"Buonanotte {name}, io vado a nanna. Spero di fare un sogno in cui giochiamo insieme!",
			"So che aspettavi il mio messaggio {name}. Eccomi qui, per augurarti di fare sogni bellissimi. A domani"
		]
	},
	{
		isoWeekday: [1,2,3,4,5],
		hours: 13,
		minutes: function() { return _.random(0, 15); },
		text: [
			"Buon appetito {name}!"
		]
	},
	{
		isoWeekday: [1,2,3,4,5],
		hours: 8,
		minutes: function() { return _.random(30, 59); },
		text: [
			"Buongiorno! Io mi sto preparando per andare a scuola, buona giornata!",
			"Ciao {name}! Apri gli occhi! Oggi sarà un'ottima goiornata, sorridi :D",
			"Bonjour {name}! Svegliati, metti i piedi giù dal letto e conquista il mondo!"
		]
	},
	{
		isoWeekday: [6,7],
		hours: function() { return _.random(9, 11); },
		minutes: function() { return _.random(0, 59); },
		text: [
			"Buongiorno {name}! Sei ancora a letto? Anch'io! :D",
		]
	},
	{
		isoWeekday: [7],
		hours: function() { return _.random(16, 18); },
		minutes: function() { return _.random(0, 59); },
		text: [
			"Buona domenica {name} :) Facciamo qualcosa di speciale oggi!",
			"La domenica si mangiano sempre cose buonissime. Qui a casa mia sempre lasagne!",
		]
	},
	{
		isoWeekday: [1,2,3,4,5,6],
		hours: function() { return _.random(16, 18); },
		minutes: function() { return _.random(0, 59); },
		text: [
			"Ciao! Sono appena tornato a casa dal rientro. Oggi ho imparato tante cose!",
			"So che stai ancora lavorando, {name}. Ti aspetto a casa per giocare insieme ;)"
		]
	},
];

function tick() {
	['telegram','messenger'].forEach((io) => {
		tickPerIO(require(__basedir + '/io/' + io));
	});
}

function tickPerIO(IO) {
	const now = moment();
	console.info('Tick', 'WK=' + now.isoWeekday(), 'H=' + now.hours(), 'M=' + now.minutes());

	// Get standard messages
	CRON_IN_DAYS.forEach((e) => {
		if (
		(e.isoWeekday ? 
			(_.isFunction(e.isoWeekday) ? (e.isoWeekday() == now.isoWeekday()) : 
			(_.isArray(e.isoWeekday) ? e.isoWeekday : [e.isoWeekday]).indexOf(now.isoWeekday()) >= 0) 
		: true) &&
		(e.hours ? 
			(_.isFunction(e.hours) ? (e.hours() == now.hour()) : 
			(_.isArray(e.hours) ? e.hours : [e.hours]).indexOf(now.hour()) >= 0) 
		: true) &&
		(e.minutes ? 
			(_.isFunction(e.minutes) ? (e.minutes() == now.minutes()) : 
			(_.isArray(e.minutes) ? e.minutes : [e.minutes]).indexOf(now.minutes()) >= 0) 
		: true)
		) {
			IO.getChats()
			.then((chats) => {
				chats.forEach((chat) => {
					let text = e.text.getRandom();
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
		}
	});
	
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

setInterval(tick, 1000 * 60);
tick();