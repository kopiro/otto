exports.id = 'memo.add';

let required_params = {
	title: "Dimmi il titolo",
	text: "Scrivi il testo",
	tags: "Dimmi i tags (separati da spazio)",
	url: "Invia una foto"
};

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		for (const k in required_params) {
			if (_.isEmpty(p[k])) {	
				if (p.wasPending) {
					p[k] = result.resolvedQuery;
					delete p.wasPending;
					continue;
				}
				return resolve({
					speech: required_params[k],
					data: {
						pending: {
							action: exports.id,
							data: _.extend(p, { wasPending: 1 })
						}
					},
				}, session_model);
			}
		}

		new ORM.Memory({
			title: p.title,
			text: p.text,
			tags: p.tags,
			url: p.url
		})
		.save()
		.then((memory) => {
			resolve({
				speech: 'Grazie!'
			});
		})
		.catch(reject);
	});
};