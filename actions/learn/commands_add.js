exports.id = 'learn.commands_add';

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;
		
		new Memory.Learning({
			input: p.input,
			reply: p.reply
		})
		.save()
		.then((learning) => {
			resolve(learning);
		})
		.catch(reject);
		
	});
};