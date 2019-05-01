exports.id = 'catfacts';

const API_EP = 'https://cat-fact.herokuapp.com/facts';
const rp = require('request-promise');

const Translator = require('../../lib/translator');

module.exports = async function main(body, session) {
  const facts = await rp(API_EP, {
    json: true,
  });
  let fact = rand(facts.all);
  fact = await Translator.translate(fact.text, session.getTranslateTo(), 'en');
  return fact;
};
