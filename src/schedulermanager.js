const TAG = 'SchedulerManager';

function tick() {
	setTimeout(tick, 60 * 1000);
	console.debug(TAG, 'tick');
	config.scheduler.forEach((name) => {
		require(__basedir + '/src/scheduler/' + name).run();
	});
}

console.info(TAG, 'started with tasks => ' + config.scheduler.join(', '));
tick();