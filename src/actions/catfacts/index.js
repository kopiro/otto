exports.id = 'catfacts';

const API_EP = 'https://cat-fact.herokuapp.com/facts';
const rp = require('request-promise');
const Translator = requireLibrary('translator');

module.exports = async function(body, session) {
	const facts = await rp(API_EP);
	let fact = rand(JSON.parse(facts).all);
	fact = await Translator.translate(fact.text, session.getTranslateTo(), 'en');
	return fact;
};
