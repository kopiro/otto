exports.id = 'selfie.shoot';

const Selfie = apprequire('selfie');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;
	const file = await Selfie.create(p.location);
	return {
		data: {
			image: {
				file: file
			}
		}
	};
};