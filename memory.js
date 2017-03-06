let knex = require('knex')({
  client: 'mysql',
  debug: true,
  connection: config.mysql
});

let bookshelf = require('bookshelf')(knex);

exports.TelegramChat = bookshelf.Model.extend({
	tableName: 'telegram_chats',
	buildData: function() {
		return { chatId: this.get('chat_id') };
	},
	getName: function() {
		return this.get('first_name') || this.get('title');
	}
});

exports.MessengerChat = bookshelf.Model.extend({
	tableName: 'messenger_chats',
});

exports.Contact = bookshelf.Model.extend({
	tableName: 'contacts',
	photos: function() {
		return this.hasMany(exports.ContactPhoto, 'contact_id');
	},
	memories: function() {
		return this.hasMany(exports.ContactMemory, 'contact_id');
	},
	getName: function() {
		return this.get('alias') || (this.get('first_name') + ' ' + this.get('last_name'));
	}
});

exports.ContactMemory = bookshelf.Model.extend({
	tableName: 'contacts_memories',
	contact: function() {
		return this.belongsTo(exports.Contact);
	}
});

exports.ContactPhoto = bookshelf.Model.extend({
	tableName: 'contacts_photos',
	contact: function() {
		return this.belongsTo(exports.Contact);
	}
});

exports.Memory = bookshelf.Model.extend({
	tableName: 'memories'
});