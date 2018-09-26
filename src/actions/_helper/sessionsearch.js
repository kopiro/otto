exports.id = '__helpers.session_search';

const SessionSearch = requireHelper('sessionsearch');

module.exports = async function({ result }, session) {
	await SessionSearch(null, session, result.resolvedQuery);
	return {};
};