const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
	return Promise.resolve({
		media: {
			what: true
		}
	});
};