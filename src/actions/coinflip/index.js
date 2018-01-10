exports.id = 'coinflip';

const Messages = apprequire('messages');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		resolve({
			speech: rand(Messages.getRaw('coinflip_choices'))
		});
	});
};