exports.id = 'spotify.configure';

const spotify = requireLibrary('spotify');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, queryText, fulfillmentText } = queryResult;
	return {
		payload: {
			url: spotify.getAuthorizeUrl(session)
		}
	};
};
