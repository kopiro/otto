const TAG = 'CronVision';

const Vision = apprequire('vision');
const Camera = apprequire('camera');
const GCS = apprequire('gcs');

function tick() {
	setTimeout(tick, 60 * 1000);
	console.info(TAG, 'Tick');

	Camera.takePhoto()
	.then((file) => {

		const path = 'vision/' + uuid() + '.jpg';
		const remote = GCS.file(path);

		fs.createReadStream(file)
		.pipe(remote.createWriteStream())
		.on('finish', () => {

			Vision.detectLabels(remote)
			.then((results) => {
				const labels = results[0];

				new ORM.Vision({
					url: path,
					labels: labels.join(',')
				}).save();
			});

		});

	});
	
}

tick();