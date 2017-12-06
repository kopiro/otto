require('./boot');

IOManager.start();

mongoose.connectDefault();

if (config.server) require(__basedir + '/src/server');
if (config.awh) require(__basedir + '/src/awh');

mongoose.connection.on('error', (err) => {
	console.error('Database connection error', err);
});

mongoose.connection.once('open', () => {
	console.info('Database connection ok');
	IOManager.startQueuePolling();
	if (config.scheduler) Scheduler.startPolling();
});