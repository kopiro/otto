exports.id = 'knowledge.get';

const Wolfram = apprequire('wolfram');
const WAIT_SPEECH = [
'Ok dammi un attimo...',
'Aspetta che te lo cerco...',
'Lo vuoi sapere proprio ora? Ok, un secondo...',
'Uffa ma non puoi cercàrtelo da solo? Aspetta che controllo...',
'Un secondo e basta e te lo dico...'
];

module.exports = function({ result }, session_model) {
	return new Promise(async(resolve) => {
		resolve({
			speech: WAIT_SPEECH.getRandom()
		});

		const speech = await Wolfram.complexQuery(result.resolvedQuery, session_model.getTranslateTo());
		IOManager.output({
			speech: speech
		}, session_model);
	});
};