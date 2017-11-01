const URL = "http://tntvillage.scambioetico.org/src/releaselist.php";

const request = require('request');

exports.search = function(q) {
	request({
		url: URL,
		method: 'POST',
		form: {
			cat: 0,
			page: 1,
			srcrel: q
		}
	}, function(err, resp, body) {
		let lines = body.split('<tr>').slice(2);
		lines.forEach((line) => {
			var cols = line.split('<td>');
			console.log(cols);
		})
	});
};