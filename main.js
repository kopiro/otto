require('./boot');

IOManager.start();

mongoose.connectDefault();

if (config.server) require(__basedir + '/src/server');
if (config.awh) require(__basedir + '/src/awh');

mongoose.connection.on('error', async(err) => {
	console.error('Database connection error', err);
	process.exit(1);
});

mongoose.connection.once('open', async() => {
	console.info('Database connection ok');
	IOManager.startQueuePolling();
	if (config.scheduler) Scheduler.startPolling();
});