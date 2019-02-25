require('./boot');

const Server = requireLibrary('server');

if (config.serverMode) {
  console.info('Running in SERVER mode');
  Server.start();
  AI.attachToServer();
} else {
  console.info('Running in CLIENT mode');
}

console.info('Connecting to database...');
mongoose.connectDefault();

mongoose.connection.on('error', async (err) => {
  console.error('Database connection error', err);
  process.exit(1);
});

mongoose.connection.once('open', async () => {
  console.info('Database connection ok');
  IOManager.start();
  IOManager.startQueuePolling();
  if (config.scheduler) Scheduler.startPolling();
});
