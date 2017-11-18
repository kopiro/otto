require('../boot');

const Translator = apprequire('translator');
const Wolfram = apprequire('wolfram');
(async function() {
	try {
		const res = await Wolfram.complexQuery('Einstein', 'it')
		console.log(res);
	} catch(err) {
		console.error(err);
	}
})();