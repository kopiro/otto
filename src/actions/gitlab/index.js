exports.id = 'gitlab';

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;

	const body = IOManager.decodeBody(fulfillment);
	
	switch (body.object_kind) {
		case 'merge_request':
		return {
			speech: fulfillment.payload.speechs.merge_request
				.replace('$_user', body.user.name)
				.replace('$_project', body.project.name)
				.replace('$_name', body.object_attributes.title)
		};
		case 'pipeline':
		switch (body.object_attributes.status) {
			case 'failed':
			return {
				speech: fulfillment.payload.speechs.pipeline.failed
				.replace('$_user', body.user.name)
				.replace('$_project', body.project.name)
			};
			case 'success':
			return {
				speech: fulfillment.payload.speechs.pipeline.success
				.replace('$_user', body.user.name)
				.replace('$_project', body.project.name)
			};
		}
		break;
	}
};