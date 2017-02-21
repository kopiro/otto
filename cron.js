const opt = [
	{
		hours: 23,
		minutes: _.random(0, 59),
		text: "E' stato bello stare insieme, ora vado a letto! Buonanotte <3"
	},
	{
		hours: 8,
		minutes: _.random(0, 59),
		text: "Buongiorno! Io mi sto preparando per andare a scuola, buona giornata!"
	},
	{
		hours: 17,
		minutes: _.random(0, 59),
		text: "Ciao! Sono appena tornato a casa dal rientro. Oggi ho imparato tante cose!"
	}
];

console.info('CRON', opt);

function tick() {
	const now = new Date();
	console.info('Tick', now.getHours(), now.getMinutes());

	opt.forEach((e) => {
		if (now.getHours() === e.hours && now.getMinutes() === e.minutes) {
			IO.getConversations()
			.then((conversations) => {
				conversations.forEach(({ id }) => {
					IO.output({
						data: { chatId: id },
						text: e.text
					});
				});
			});
		}
	});
}

setInterval(tick, 1000 * 60);
tick();