require('../main');

IOManager.emitter.on('session_ready', () => {
	require('../src/scheduler/good_morning').run({
		session: IOManager.session
	});
});