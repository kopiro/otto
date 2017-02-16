module.exports = function(request) {
	console.info('AI.tellNameOf', request);
	return new Promise(function(resolve, reject) {
		var who = request.entities.contact[0].value.toLowerCase();
		switch (who) {

			case 'mamma':
			resolve({ text: 'La mia mamma è Valentina' });
			break;

			case 'papà':
			resolve({ text: 'Il mio papà è Flavio!' });
			break;

			default:
			reject({ text: 'Non so chi sia ' + who });
			break;		

		}
	});
};