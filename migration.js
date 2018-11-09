db.createCollection('sessions');
db.createCollection('session_inputs');
db.createCollection('io_queues');
db.createCollection('schedulers');
db.createCollection('stories');

db.sessions.createIndex(
	{
		alias: 'text'
	},
	{ default_language: 'it', language_override: 'it' }
);

db.music.createIndex(
	{
		name: 'text'
	},
	{ default_language: 'it', language_override: 'it' }
);

db.stories.createIndex(
	{
		title: 'text',
		text: 'text',
		tags: 'text'
	},
	{ default_language: 'it', language_override: 'it' }
);
