const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('otto.db');
const _ = require('underscore');
const request = require('request');

const stmt_answert_get_by_question = db.prepare("SELECT * FROM answers WHERE id IN (SELECT id_answer FROM questions_lookup WHERE id_question = ?)");

const stmt_answer_get = db.prepare('SELECT * FROM answers WHERE id = ?');
const stmt_questions_get = db.prepare('SELECT * FROM questions');

const entities_tokenizator = /([^\s]+)/g;

const DONTUNDESTAND_ANS = [
'Scusami, ma non ti capisco',
'Scusa, non ho capito',
'Potresti ripetere?'
];


var AIFilters = {
	NOOP: function() {
		return new Promise(function(resolve, reject) {
			resolve();
		});
	},
	GREETING: function(e) {
		return new Promise(function(resolve, reject) {
			resolve({
				name: e.matches[1]
			});
		});
	},
	WEATHER: function(e) {
		return new Promise(function(resolve, reject) {
			request.get('http://api.wunderground.com/api/52b9eb40eff73d91/conditions/lang:IT/q/IT/' + e.matches[1] + '.json', function(err, resp, body) {
				body = JSON.parse(body);
				resolve({
					type: body.current_observation.weather
				});
			});
		});
	}
};

function AI() {
	var self = this;
	self.all_questions = [];
}

AI.prototype.init = function() {
	var self = this;
	return new Promise(function(resolve, reject) {
		stmt_questions_get.all(function(err, questions) {
			questions.forEach(function(question) {
				self.all_questions.push({
					id: question.id,
					regex: new RegExp(question.text)
				});
			});
			resolve();
		});
	});
};

AI.prototype.startConversation = function(data) {
	var self = this;

	console.log('AI: requesting conversation', data);
	
	return new Promise(function(resolve, reject) {
		var text = data.text.toLowerCase();

		var questions_candidates = [];
		
		self.all_questions.forEach(function(q) {
			if (q.regex.test(text)) {
				q.matches = text.match(q.regex);
				questions_candidates.push(q);
			}
		});

		// Order the questions by matches
		var question_best = questions_candidates.sort(function(qa, qb) {
			return qa.matches.length < qb.matches.length ? 1 : -1;
		}).shift();

		if (question_best == null) {
			console.log('AI no answer');
			resolve( DONTUNDESTAND_ANS[Math.floor(Math.random() * DONTUNDESTAND_ANS.length)] );
			return;
		}

		console.log('AI Best question', question_best.id, question_best.regex);

		stmt_answert_get_by_question.all(question_best.id, function(err, answers) {
			if (err) return reject(err);
			if (answers.lenght == 0) return reject();

			var ans = answers[ Math.floor(Math.random() * answers.length) ];
			
			var text = ans.text;
			var filter = ans.filter || 'NOOP';

			AIFilters[ filter ]( question_best ).then(function(action_data) {

				text = text.replace(/\{(.+)\}/g, function(cmatch, key) {
					return action_data[key];
				});

				console.log('AI Response', text);
				resolve(text);

			});
		});
	});

};

module.exports = AI;