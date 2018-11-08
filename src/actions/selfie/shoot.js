exports.id = 'selfie.shoot';

const Selfie = requireLibrary('selfie');
const Server = requireLibrary('server');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;

	const file = await Selfie.create(p.location || 'Iceland');
	const fileUrl = Server.getURIFromFSFilePath(file);

	return {
		payload: {
			image: {
				uri: fileUrl
			}
		}
	};
};
