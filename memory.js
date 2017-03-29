const knex = require('knex')({
  client: 'mysql',
  debug: false,
  connection: config.mysql
});

const bookshelf = require('bookshelf')(knex);

exports.__knex = knex;
exports.__bookshelf = bookshelf;

exports.Cron = bookshelf.Model.extend({
	tableName: 'cron',
});

exports.Session = bookshelf.Model.extend({
	tableName: 'sessions',
	getIOData: function() {
		return JSON.parse( this.get('io_data') );
	},
	getName: function() {
		return this.get('first_name') || this.get('title');
	},
	contact: function() {
		return this.belongsTo(exports.Contact, 'contact_id');
	},
});

exports.SessionInput = bookshelf.Model.extend({
	tableName: 'sessions_inputs',
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
	tableName: 'alarms',
	session: function() {
		return this.belongsTo(exports.Session, 'session_id');
	},
});