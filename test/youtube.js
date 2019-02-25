require('../boot');
const Youtube = requireLibrary('youtube');

Youtube.searchVideos('Centuries', 4)
.then(results => {
	console.dir(results[0], { depth: 20 });
})
.catch(console.log);