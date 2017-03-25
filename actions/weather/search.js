exports.id = 'weather.search';

const Wunderground = require(__basedir + '/support/wunderground');

const wg_qualifiers = ['chance','mostly','partly'];

const wg_qualifiers_to_lang = {
	'chance': 'possibilità di',
	'mostly': 'per la maggior parte',
	'partly': 'parzialmente'
};

const wg_conditions_to_lang = {
	flurries: 'Vento',
	rain: 'Pioggia',
	sleet: 'Nevischio',
	snow: 'Neve',
	sunny: 'Sole',
	cloudy: 'Nuvoloso',
	hazy: 'Nebbia',
	fog: 'Nebbia',
	clear: 'Sereno'
};

const apiai_to_lang = {
	fog: 'Nebbia',
	overcast: 'Nuvoloso', 
	rain: 'Pioggia',
	snow: 'Neve',
	storm: 'Temporale',
	sun: 'Sole',
	wind: 'Vento'
};

const apiai_to_wunderground = {
	fog: ['fog','hazy'],
	overcast: ['cloudy','mostlycloudy','partlycloudy'], 
	rain: ['rain','chancerain'],
	snow: ['snow','sleet','chancesnow','chancesleet'],
	storm: ['tstorms','chancetstorms'],
	sun: ['sunny','clear','partlysunny','mostlysunny'],
	wind: ['flurries','chanceflurries'],
};

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);
		const { parameters:p } = e;

		if (p.date) {
			const date = moment(p.date + (p.time ? ' ' + p.time : '09:00:00'));
			const date_human = date.calendar();

			Wunderground.api({
				type: 'forecast',
				city: p.location,
			}, (err, data) => {

				const fores = data.forecast.simpleforecast.forecastday;
				if (fores == null) return reject();

				const obs = _.find(fores, (o) => { return o.date.epoch >= date.unix(); });
				if (obs == null) return reject();

				resolve({
					text: `${date_human}, ci sarà ${obs.conditions}, con una massima di ${obs.high.celsius} gradi e una minima di ${obs.low.celsius}`
				});
			});

		} else {
			Wunderground.api({
				type: 'conditions',
				city: p.location,
			}, (err, data) => {

				const obs = data.current_observation;
				if (obs == null) return reject();

				switch (p.request_type) {
					case 'condition':
					const desc = p.condition_description;
					
					if (apiai_to_wunderground[desc]) {
						const wg_search_condition = apiai_to_wunderground[desc]; // ex: ['snow','sleet','chancesnow','chancesleet']
						if (wg_search_condition.indexOf( obs.icon ) >= 0) { // chancesnow
							const wg_condition_wt_qualifiers = obs.icon.replace(new RegExp(wg_qualifiers.join('|'), 'g'), ''); // snow
							const wg_qualifier = wg_qualifiers.find((q) => { return obs.icon.indexOf(q) === 0; }); // chance
							const qualifier = wg_qualifiers_to_lang[wg_qualifier] || '';

							resolve({
								text: `Si, è prevista ${qualifier} ${wg_conditions_to_lang[wg_condition_wt_qualifiers]} a ${obs.display_location.city}`
							});
						} else { // no snow
							resolve({
								text: `No, non è prevista ${apiai_to_lang[desc]} a ${obs.display_location.city}`
							});
						}
					} else {
						// Fallback
						resolve({
							text: `A ${obs.display_location.city}, il tempo risulta essere ${obs.weather}, con una temperatura media di ${obs.temp_c} gradi`
						});
					}
					break;

					case 'explicit':
					resolve({
						text: `A ${obs.display_location.city}, il tempo risulta essere ${obs.weather}, con una temperatura media di ${obs.temp_c} gradi`
					});
					break;

					default:
					reject();
					break;
				}

			});
		}
		
	});
};