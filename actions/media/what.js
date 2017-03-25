exports.id = 'media.what';

module.exports = function(e) {
	return Promise.resolve({
		media: {
			what: true
		}
	});
};