exports.tagExtactor = function(text) {
	let tags = [];
	text = text.replace(/[^a-zA-Z ]+/g, '');
	text.split(' ').forEach(function(tag) {
		if (tag.substr(0,1) === tag.substr(0,1).toUpperCase() || tag.length >= 4) {
			tags.push(tag.toLowerCase());
		}
	});

	let query = " JOIN tags ON tags.id_memory = memories.id WHERE ";
	query += "(" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
	query += "GROUP BY memories.id ORDER BY COUNT(tag) LIMIT 1";
	return {
		query: query,
		values: tags
	};
};