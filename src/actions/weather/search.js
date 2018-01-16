exports.id = 'weather.search';

const _ = require('underscore');
const Moment = apprequire('moment');
const Wunderground = apprequire('wunderground');

const WG_QUALIFIERS = ['chance','mostly','partly'];

const INTENT_TO_WG = {
	fog: ['fog','hazy'],
	cloudy: ['cloudy','mostlycloudy','partlycloudy'], 
	rain: ['rain','chancerain'],
	snow: ['snow','sleet','chancesnow','chancesleet'],
	storm: ['tstorms','chancetstorms'],
	sun: ['sunny','clear','partlysunny','mostlysunny'],
	wind: ['flurries','chanceflurries'],
};

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;

	const now = Moment();
	let date;
	if (!_.isEmpty(p.date) && !_.isEmpty(p.time)) {		
		date = Moment(p.date + ' ' + p.time, 'YYYY-MM-DD HH:mm:ss');
	} else if (!_.isEmpty(p.date)) {
		date = Moment(p.date + now.format('HH:mm:ss'), 'YYYY-MM-DD HH:mm:ss');
	} else if (!_.isEmpty(p.time)) {
		date = Moment(now.format('YYYY-MM-DD') + ' ' + p.time, 'YYYY-MM-DD HH:mm:ss');
	} else {
		date = now;
	}

	let human_date = date.fromNow();
	const tempo = date.isSame(now) ? 'present' : (date.isAfter(now) ? 'future' : 'past');

	const data = await Wunderground.api({
		type: 'forecast',
		city: p.location,
	});

	const fores = data.forecast.simpleforecast.forecastday;
	if (fores == null) throw fulfillment.payload.error;

	const obs = _.find(fores, (o) => { return o.date.epoch >= date.unix(); });
	if (obs == null) throw fulfillment.payload.error;

	if (p.request_type === 'condition') {
		const c = p.condition_description;
		const condition = fulfillment.payload.conditions[c];

		if (null == INTENT_TO_WG[c]) {
			throw fulfillment.payload.error;
		}

		const e = INTENT_TO_WG[c];
		if (e.indexOf(obs.icon) >= 0) {
			const _qualifier = WG_QUALIFIERS.find((q) => (obs.icon.indexOf(q) === 0));
			const qualifier = fulfillment.payload.qualifiers[_qualifier];
			return ({
				speech: fulfillment.payload.speechs[ 'yes_' + tempo ]
				.replace('$_condition', condition)
				.replace('$_qualifier', qualifier)
				.replace('$_location', p.location)
				.replace('$_date', human_date)
			});
		} else {
			return ({
				speech: fulfillment.payload.speechs[ 'no_' + tempo ]
				.replace('$_condition', condition)
				.replace('$_location', p.location)
				.replace('$_date', human_date)
			});
		}

	} else if (p.request_type === 'explicit') {
		const avg_temp = ((parseInt(obs.high.celsius, 10) + parseInt(obs.low.celsius, 10)) / 2).toFixed(0);
		return ({
			speech: fulfillment.payload.speech
			.replace('$_location', p.location)
			.replace('$_conditions', obs.conditions)
			.replace('$_avg_temp', avg_temp)
			.replace('$_date', date)
		});
	}
};