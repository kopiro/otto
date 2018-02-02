exports.id = 'gitlab';

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;
	const body = JSON.parse(new Buffer(fulfillment.payload.body, 'base64').toString('ascii'));
	switch (body.object_kind) {
		case 'merge_request':
		return {
			speech: fulfillment.payload.speechs.merge_request
				.replace('$_user', body.user.name)
				.replace('$_project', body.project.name)
				.replace('$_name', body.object_attributes.title)
		};
		break;
	}
};