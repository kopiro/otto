module.exports = function tellNameOf(request) {
	console.info('AI.tellNameOf', request);

	return new Promise(function(resolve, reject) {
		var who = request.entities.contact[0].value.toLowerCase();
		switch (who) {

			case 'mamma':
			case 'madre':
			resolve({ text: 'La mia mamma è Valentina' });
			break;

			case 'papà':
			case 'babbo':
			case 'padre':
			resolve({ text: 'Il mio papà è Flavio!' });
			break;

			case 'flavio':
			resolve({ text: 'Flavio è il mio papà' });
			break;

			case 'valentina':
			resolve({ text: 'Valentina è la mia mamma!' });
			break;

			default:
			reject({ 
				sessionId: request.sessionId,
				text: 'Non so chi sia ' + who 
			});
			break;		

		}
	});
};