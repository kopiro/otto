exports.id = '__helpers.session_search';

const SessionSearch = helperrequire('sessionsearch');

module.exports = async function({ result }, session) {
	await SessionSearch(null, session, result.resolvedQuery);
	return {};
};