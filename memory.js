let knex = require('knex')({
  client: 'mysql',
  connection: config.mysql
});

let bookshelf = require('bookshelf')(knex);

exports.TelegramChat = bookshelf.Model.extend({
	tableName: 'telegram_chats',
});

exports.MessengerChat = bookshelf.Model.extend({
	tableName: 'messenger_chats',
});

exports.Contact = bookshelf.Model.extend({
	tableName: 'contacts',
	photos: function() {
		return this.hasMany(exports.ContactPhoto, 'contact_id');
	},
	getName: function() {
		return this.get('name');
	}
});

exports.ContactPhoto = bookshelf.Model.extend({
	tableName: 'contact_photos',
	contact: function() {
		return this.belongsTo(exports.Contact);
	}
});

exports.Memory = bookshelf.Model.extend({
	tableName: 'memories'
}, {

	byText: function(text) {
		return new Promise((resolve, reject) => {

			// Prepare tags
			let tags = [];
			text = text.replace(/[^a-zA-Z ]+/g, '');
			text.split(' ').forEach(function(tag) {
				if (tag.substr(0,1) === tag.substr(0,1).toUpperCase() || tag.length >= 4) {
					tags.push(tag.toLowerCase());
				}
			});

			let query = "SELECT *, COUNT(tag) as tags_matched FROM memories ";
			query += "INNER JOIN memory_tags ON memory_tags.id_memory = memories.id ";
			query += "AND (" + tags.map(() => { return "tag = ?"; }).join(" OR ") + ") ";
			query += "GROUP BY memories.id ORDER BY tags_matched DESC";

			DB.query(query, tags, (err, memories) => {
				if (err) return reject(err);
				if (memories.length == 0) return reject(err);

				// Since we ordered by tags_matched, the first one is the max
				let max_tags_matched = memories[0].tags_matched;
				memories = memories.filter((memory) => { 
					return memory.tags_matched == max_tags_matched;
				});
				let memory = memories[ _.random(0, memories.length - 1) ];

				resolve(new exports.Memory(memory));
			});
		});
	}

});

exports.MemoryTags = bookshelf.Model.extend({
	tablename: 'memory_tags'
});