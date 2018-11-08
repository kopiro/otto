exports.id = 'shutdown.now';

const exec = require('child_process').exec;

module.exports = function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	exec('shutdown now', (err, stdout, stderr) => {});
	return fulfillmentText;
};
