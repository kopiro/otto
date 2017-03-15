let knex = require('knex')({
  client: 'mysql',
  debug: false,
  connection: config.mysql
});

let bookshelf = require('bookshelf')(knex);

exports.__knex = knex;
exports.__bookshelf = bookshelf;

exports.TelegramChat = bookshelf.Model.extend({
	tableName: 'telegram_chats',
	// This function is used to build the data 
	// that will be sent over the IO driver
	buildData: function() {
		return { chatId: this.id };
	},
	getName: function() {
		return this.get('first_name') || this.get('title');
	},
	contact: function() {
		return this.belongsTo(exports.Contact, 'contact_id');
	},
});

exports.MessengerChat = bookshelf.Model.extend({
	tableName: 'messenger_chats',
	// This function is used to build the data 
	// that will be sent over the IO driver
	buildData: function() {
		return { senderId: this.id };
	},
	getName: function() {
		return this.get('first_name') || this.get('title');
	},
	contact: function() {
		return this.belongsTo(exports.Contact, 'contact_id');
	}
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

exports.Learning = bookshelf.Model.extend({
	tableName: 'learning'
});

exports.Alarm = bookshelf.Model.extend({
	tableName: 'alarms'
});