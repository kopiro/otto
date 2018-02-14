exports.id = 'maps.distance';

const GoogleMaps = apprequire('googlemaps');
const Moment = apprequire('moment');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		GoogleMaps.directions(p, (err, response) => {
			if (err) return;

			const distance = response.json.routes[0].legs[0].distance.text;

			const duration = response.json.routes[0].legs[0].duration.value;
			const duration_human = Moment.duration(duration * 1000).humanize();

			resolve({
				speech: fulfillment.speech
					.replace('$_distance', distance)
					.replace('$_duration', duration_human)
			});		
		});
	});
};