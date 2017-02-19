const opt = [
	{
		hours: 23,
		minutes: 55,
		text: "E' stato bello stare insieme, ora vado a letto! Buonanotte <3"
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