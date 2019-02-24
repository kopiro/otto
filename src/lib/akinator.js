const TAG = 'Akinator';
const request = require('request');

class Akinator {
  constructor(language) {
    this.url = `http://api-${language}2.akinator.com/ws/`;
    this.session = null;
    this.signature = null;
    this.onAsk = null;
    this.step = 0;
  }

  hello(playerName, onAsk, onFound) {
    this.onAsk = onAsk;
    this.onFound = onFound;
    request(`${this.url}new_session?partner=1&player=${playerName}`, (error, response, body) => {
      console.debug(TAG, body);
      if (!error && response.statusCode == 200) {
        let rs = JSON.parse(body);
        this.session = rs.parameters.identification.session;
        this.signature = rs.parameters.identification.signature;
        rs = this.extractQuestion(rs);
        this.onAsk(rs.question, rs.answers);
      }
    });
  }

  extractQuestion(response) {
    let { parameters } = response;
    if (parameters.step_information) parameters = parameters.step_information;

    const question = {
      id: parameters.questionid,
      text: parameters.question,
    };
    const answers = [];
    for (const ans in parameters.answers) {
      answers.push({
        id: ans,
        text: parameters.answers[ans].answer,
      });
    }
    return {
      question,
      answers,
      last: parameters.progression >= 95,
    };
  }

  sendAnswer(answerId) {
    request(`${this.url}answer?session=${this.session}&signature=${this.signature}&step=${this.step}&answer=${answerId}`, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        let rs = JSON.parse(body);
        rs = this.extractQuestion(rs);
        if (rs.last) {
          this.getCharacters();
        } else {
          this.onAsk(rs.question, rs.answers);
        }
      }
    });
    this.step++;
  }

  getCharacters() {
    request(`${this.url}list?session=${this.session}&signature=${this.signature}&step=${this.step}&size=2&max_pic_width=246&max_pic_height=294&pref_photos=OK-FR&mode_question=0`, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        const rs = JSON.parse(body);
        const characters = rs.parameters.elements.map(el => el.element);
        this.onFound(characters);
      }
    });
    this.step++;
  }
}

exports.data = {};

exports.create = function (language) {
  return new Akinator(language);
};
