db.createCollection('sessions');
db.createCollection('session_inputs');

db.createCollection('io_queues');

db.createCollection('alarms');
db.createCollection('contacts');

db.createCollection('schedulers');
db.createCollection('visions');
db.createCollection('knowledges');
db.createCollection('stories');
db.createCollection('chess_games');

db.knowledges.createIndex({ 
	'input':'text'
}, { 'default_language':'it','language_override': 'it' });

db.sessions.createIndex({ 
	'alias':'text',
}, { 'default_language':'it','language_override': 'it' });

db.music.createIndex({ 
	'name':'text',
}, { 'default_language':'it','language_override': 'it' });

db.stories.createIndex({ 
	'title':'text', 
	'text':'text',
	'tags':'text'
}, { 'default_language':'it','language_override': 'it' });
