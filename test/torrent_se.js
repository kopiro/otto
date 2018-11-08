require('../boot');
const { promisify } = require('util');
const SE = requireLibrary('torrent/se');
const Transmission = requireLibrary('torrent/transmission');

(async () => {
	const elements = await SE.query('chuck s01');
	console.log('elements :', elements);
	Transmission.addUrl(elements[0].magnet);
})();
