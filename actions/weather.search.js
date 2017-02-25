const TAG = path.basename(__filename, '.js');
const Wunderground = require(__basedir + '/support/wunderground');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters: p } = e;

		if (p.date) {
			let date = moment(p.date);
			Wunderground.api({
				type: 'forecast',
				city: p.location,
			}, (err, data) => {

				let fores = data.forecast.simpleforecast.forecastday;
				if (fores == null) return reject();

				let obs = _.find(fores, (o) => { return o.date.epoch >= date.unix(); });
				if (obs == null) return reject();

				resolve(`Da ${obs.date.pretty}, c'è ${obs.conditions}, con una massima di ${obs.high.celsius} gradi e una minima di ${obs.low.celsius}`);
			});
		} else {
			Wunderground.api({
				type: 'conditions',
				city: p.location,
			}, (err, data) => {
				let obs = data.current_observation;
				if (obs == null) return reject();
				resolve(`A ${obs.display_location.city}, il tempo risulta essere ${obs.weather}, con una temperatura media di ${obs.temp_c} gradi`);
			});
		}

		
	});
};