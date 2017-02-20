const opt = [
	{
		hours: 23,
		minutes: 55,
		text: "E' stato bello stare insieme, ora vado a letto! Buonanotte <3"
	},
	{
		hours: 8,
		minutes: 30,
		text: "Buongiorno! Io mi sto preparando per andare a scuola, buona giornata!"
	},
	{
		hours: 17,
		minutes: _.random(0, 59),
		text: "Ciao! Sono appena tornato a casa dal rientro. Oggi ho imparato tante cose!"
	}
];

function tick() {
	const now = new Date();
	console.info('Tick', now.getHours(), now.getMinutes());

	opt.forEach((e) => {
		if (now.getHours() === e.hours && now.getMinutes() === e.minutes) {
			IO.getConversations()
			.then((conversations) => {
				conversations.forEach(({ id }) => {
					IO.output({
						sessionId: id,
						text: e.text
					});
				});
			});
		}
	});
}

setInterval(tick, 1000 * 60);
tick();