require('./boot');

let Server = apprequire('server');

if (config.serverMode) {
	console.log('Running in SERVER mode');
	Server.start();
	AI.attachToServer();
} else {
	console.log('Running in CLIENT mode');
}

IOManager.start();
mongoose.connectDefault();

mongoose.connection.on('error', async (err) => {
	console.error('Database connection error', err);
	IOManager.eventToAllIO('database.error');
	process.exit(1);
});

mongoose.connection.once('open', async () => {
	console.info('Database connection ok');
	IOManager.eventToAllIO('database.up');
	IOManager.startQueuePolling();
	if (config.scheduler) Scheduler.startPolling();
});