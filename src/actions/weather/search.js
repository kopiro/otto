exports.id = 'weather.search';

const Wunderground = apprequire('wunderground');

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
	cloudy: 'Nuvoloso', 
	rain: 'Pioggia',
	snow: 'Neve',
	storm: 'Temporale',
	sun: 'Sole',
	wind: 'Vento'
};

const apiai_to_wunderground = {
	fog: ['fog','hazy'],
	cloudy: ['cloudy','mostlycloudy','partlycloudy'], 
	rain: ['rain','chancerain'],
	snow: ['snow','sleet','chancesnow','chancesleet'],
	storm: ['tstorms','chancetstorms'],
	sun: ['sunny','clear','partlysunny','mostlysunny'],
	wind: ['flurries','chanceflurries'],
};

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		let date = null;
		if (!_.isEmpty(p.date)) {		
			date = moment(p.date + (!_.isEmpty(p.time) ? (' ' + p.time) : ' 09:00:00'));
		} else {
			date = moment();
		}
		const date_human = date.calendar();

		Wunderground.api({
			type: 'forecast',
			city: p.location,
		}, (err, data) => {

			const fores = data.forecast.simpleforecast.forecastday;
			if (fores == null) return reject();

			const obs = _.find(fores, (o) => { return o.date.epoch >= date.unix(); });
			if (obs == null) return reject();

			console.debug(exports.id, obs);

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
							speech: `Si, è prevista ${qualifier} ${wg_conditions_to_lang[wg_condition_wt_qualifiers]} a ${p.location}`
						});
					} else { // no snow
						resolve({
							speech: `No, non è prevista ${apiai_to_lang[desc]} a ${p.location}`
						});
					}
					break;
				}
				// no-break
					
				case 'explicit':
				const avg_temp = ((parseInt(obs.high.celsius, 10) + parseInt(obs.low.celsius, 10)) / 2).toFixed(0);
				resolve({
					speech: `A ${p.location}, il tempo risulta essere ${obs.conditions}, con una temperatura media di ${avg_temp} gradi`
				});
				break;

				default:
				reject();
				break;
			}
		});
	});
};