let IO = require(__basedir + '/io/telegram');

const opt = [
	{
		isoWeekday: [1,2,3,4,5,6],
		hours: [23],
		minutes: [0],
		text: [
			"E' stato bello stare insieme, ora vado a letto! Buonanotte <3",
			"Buonanotte {name}, io vado a nanna. Spero di fare un sogno in cui gichiamo insieme!",
			"So che aspettavi il mio messaggio {name}. Eccomi qui, per augurarti di fare sogni bellissimi. A domani"
		]
	},
	{
		isoWeekday: [1,2,3,4,5,6],
		hours: [8],
		minutes: [30],
		text: [
			"Buongiorno! Io mi sto preparando per andare a scuola, buona giornata!",
			"Ciao {name}! Apri gli occhi! Oggi sarà un'ottima goiornata, sorridi :D",
			"Bonjour {name}! Svegliati, metti i piedi giù dal letto e conquista il mondo!"
		]
	},
	{
		isoWeekday: [7],
		hours: [10],
		minutes: [0],
		text: [
			"Buongiorno {name}! Sei ancora a letto? Anch'io! :D",
			"Buona domenica {name} Facciamo qualcosa di speciale oggi!"
		]
	},
	{
		isoWeekday: [7],
		hours: [16],
		minutes: [0],
		text: [
			"La domenica si mangiano sempre cose buonissime. Qui a casa mia sempre lasagne!",
		]
	},
	{
		isoWeekday: [1,2,3,4,5,6],
		hours: [17],
		minutes: [30],
		text: [
			"Ciao! Sono appena tornato a casa dal rientro. Oggi ho imparato tante cose!",
			"So che stai ancora lavorando, {name}. Ti aspetto a casa per giocare insieme ;)"
		]
	},
];

function tick() {
	const now = moment();
	console.info('Tick', 'WK=' + now.isoWeekday(), 'H=' + now.hours(), 'M=' + now.minutes());

	opt.forEach((e) => {
		if (
		(e.isoWeekday ? e.isoWeekday.indexOf(now.isoWeekday()) >= 0 : true) &&
		(e.hours ? e.hours.indexOf(now.hour()) >= 0 : true) &&
		(e.minutes ? e.minutes.indexOf(now.minutes()) >= 0 : true)
		) {
			IO.getChats()
			.then((conversations) => {
				conversations.forEach((conv) => {
					let text = e.text[_.random(0, e.text.length - 1)];
					text = text.replace('{name}', conv.getName());
					IO.output(conv.getData(), text);
				});
			});
		}
	});
}

setInterval(tick, 1000 * 60);
tick();