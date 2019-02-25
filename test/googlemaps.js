require('../boot');
const GoogleMaps = requireLibrary('googlemaps');
GoogleMaps.directions(
	{
		origin: 'Parma',
		destination: 'Rome'
	},
	function(err, response) {
		// console.log(response.json.routes[0].legs[0]);
		console.log(
			response.json.routes[0].legs[0].distance.text,
			response.json.routes[0].legs[0].duration.text
		);
	}
);
