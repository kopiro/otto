exports.id = 'repeat';

module.exports = function({ queryResult }, session) {
	let { parameters: p } = queryResult;
	return p.q;
};
