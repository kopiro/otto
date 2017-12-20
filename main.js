require('./boot');

const Play = apprequire('play');
Play.fileToSpeaker(__etcdir + '/boot.mp3');

IOManager.start();

mongoose.connectDefault();

if (config.server) require(__basedir + '/src/server');
if (config.awh) require(__basedir + '/src/awh');

mongoose.connection.on('error', async(err) => {
	console.error('Database connection error', err);
	Play.kill().fileToSpeaker(__etcdir + '/nointernet.mp3');
	setTimeout(() => {
		process.exit(1);
	}, 2000);
});

mongoose.connection.once('open', async() => {
	console.info('Database connection ok');
	IOManager.startQueuePolling();
	if (config.scheduler) Scheduler.startPolling();
});