const TAG = 'Akinator';
var request = require('request');

var Akinator = function(language) {
	this.url = `http://api-${language}2.akinator.com/ws/`;
	this.session = null;
	this.signature = null;
	this.onAsk = null;
	this.step = 0;
};

Akinator.prototype.hello = function(playerName, onAsk, onFound) {
	this.onAsk = onAsk;
	this.onFound = onFound;
	request(this.url + `new_session?partner=1&player=${playerName}`, (error, response, body) => {
		console.debug(TAG, body);
		if (!error && response.statusCode == 200) {
			var rs = JSON.parse(body);
			console.debug(exports.id, rs);
			this.session = rs.parameters.identification.session;
			this.signature = rs.parameters.identification.signature;
			rs = this.extractQuestion(rs);
			this.onAsk(rs.question, rs.answers);
		}
	});
};

Akinator.prototype.extractQuestion = function(response) {
	var parameters = response.parameters;
	if (parameters.step_information) parameters = parameters.step_information;

	var question = {
		id: parameters.questionid,
		text: parameters.question
	};
	var answers = [];
	for (var ans in parameters.answers) {
		answers.push({
			id: ans,
			text: parameters.answers[ans].answer
		});
	}
	return {
		question: question,
		answers: answers,
		last: parameters.progression >= 95
	};
};

Akinator.prototype.sendAnswer = function(answerId) {
	request(this.url + 'answer?session=' + this.session + '&signature=' + this.signature + '&step=' + this.step + '&answer=' + answerId, (error, response, body) => {
		console.debug(TAG, body);
		if (!error && response.statusCode == 200) {
			var rs = JSON.parse(body);
			console.debug(exports.id, rs);
			rs = this.extractQuestion(rs);
			if (rs.last) {
				this.getCharacters();
			} else {
				this.onAsk(rs.question, rs.answers);
			}
		}
	});
	this.step++;
};

Akinator.prototype.getCharacters = function() {
	request(this.url + 'list?session=' + this.session + '&signature=' + this.signature + '&step=' + this.step + '&size=2&max_pic_width=246&max_pic_height=294&pref_photos=OK-FR&mode_question=0', (error, response, body) => {
		console.debug(TAG, body);
		if (!error && response.statusCode == 200) {
			var rs = JSON.parse(body);
			console.debug(exports.id, rs);
			var characters = rs.parameters.elements.map((el) => {
				return el.element;
			});
			this.onFound(characters);
		}
	});
	this.step++;
};

exports.data = {};

exports.create = function(language) {
	return new Akinator(language);
};