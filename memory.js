let knex = require('knex')({
  client: 'mysql',
  debug: true,
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
		return this.get('alias') || (this.get('first_name') + ' ' + this.get('last_name'));
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
});