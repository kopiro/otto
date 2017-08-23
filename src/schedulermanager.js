const TAG = 'SchedulerManager';

function tick() {
	setTimeout(tick, 60 * 1000);
	
	config.scheduler.forEach((name) => {
		require(__basedir + '/src/scheduler/' + name).run();
	});
}

console.info(TAG, 'started with task => ' + config.scheduler.join(', '));
tick();