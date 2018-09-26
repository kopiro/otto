exports.id = 'catfacts';

const API_EP = 'https://cat-fact.herokuapp.com/facts';
const rp = require('request-promise');
const Translator = apprequire('translator');

module.exports = async function({ sessionId, result }, session) {
   let { parameters: p, fulfillment } = result;
   
   const facts = await rp(API_EP);

   let fact = rand(JSON.parse(facts).all);

   console.log('fact :', fact);
   fact = await Translator.translate(fact.text, session.getTranslateTo(), 'en');

   return {
      speech: fact
   };
};