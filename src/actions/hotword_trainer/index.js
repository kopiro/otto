exports.id = 'hotword_trainer';

const Hotword = apprequire('hotword');

module.exports = function({ sessionId, result }) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		resolve({});

		let io = IOManager.getDriver('kid');
		await io.stopInput();
		await Hotword.getModels(true);
		await io.startInput();
	});
};