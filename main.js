require('./boot');

if (config.serverMode) {
	console.log('Running in SERVER mode');
	apprequire('server').start();
} else {
	console.log('Running in CLIENT mode');
}

IOManager.start();
mongoose.connectDefault();

mongoose.connection.on('error', async(err) => {
	console.error('Database connection error', err);
	process.exit(1);
});

mongoose.connection.once('open', async() => {
	console.info('Database connection ok');
	IOManager.startQueuePolling();
	if (config.scheduler) Scheduler.startPolling();
});