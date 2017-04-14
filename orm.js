const knex = require('knex')({
  client: 'mysql',
  debug: false,
  connection: config.mysql
});

const bookshelf = require('bookshelf')(knex);

exports.__knex = knex;
exports.__bookshelf = bookshelf;

exports.IOQueue = bookshelf.Model.extend({
	tableName: 'io_queue',
	session: function() {
		return this.belongsTo(exports.Session, 'session_id');
	},
	getData: function() {
		return JSON.parse(this.get('data'));
	}
});

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
	setTranslateFrom: function(x) {
		if (x == config.language) x = null;
		this.set('translate_from', x);
	},
	setTranslateTo: function(x) {
		if (x == config.language) x = null;
		this.set('translate_to', x);
	},
	getTranslateFrom: function() {
		return this.get('translate_from') || config.language;
	},
	getTranslateTo: function() {
		return this.get('translate_to') || config.language;
	}
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
	sessions: function() {
		return this.hasMany(exports.Session, 'contact_id');
	},
	getName: function() {
		return this.get('alias') || (this.get('first_name') + ' ' + this.get('last_name'));
	},
	getUniqueName: function() {
		return (this.get('first_name') + ' ' + this.get('last_name'));
	}
}, {
	search: function(text, fetch_opt = {}) {
		return new ORM.Contact()
		.query((qb) => {
			qb.select(ORM.__knex.raw(`*, 
			MATCH (first_name, last_name, alias) AGAINST ("${text}") AS score
			`));
			qb.having('score', '>', '0');
			qb.orderBy('score', 'DESC');
		})
		.fetchAll(fetch_opt);
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