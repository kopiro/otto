exports.id = 'weather.search';

const _ = require('underscore');
const Moment = requireLibrary('moment');
const Wunderground = requireLibrary('wunderground');

const WG_QUALIFIERS = ['chance', 'mostly', 'partly'];

const INTENT_TO_WG = {
	fog: ['fog', 'hazy'],
	cloudy: ['cloudy', 'mostlycloudy', 'partlycloudy'],
	rain: ['rain', 'chancerain'],
	snow: ['snow', 'sleet', 'chancesnow', 'chancesleet'],
	storm: ['tstorms', 'chancetstorms'],
	sunny: ['sunny', 'clear', 'partlysunny', 'mostlysunny'],
	wind: ['flurries', 'chanceflurries']
};

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText, fulfillmentMessages } = queryResult;

	const now = Moment();
	let date;
	if (!_.isEmpty(p.date) && !_.isEmpty(p.time)) {
		date = Moment(p.date + ' ' + p.time, 'YYYY-MM-DD HH:mm:ss');
	} else if (!_.isEmpty(p.date)) {
		date = Moment(p.date + now.format('HH:mm:ss'), 'YYYY-MM-DD HH:mm:ss');
	} else if (!_.isEmpty(p.time)) {
		date = Moment(
			now.format('YYYY-MM-DD') + ' ' + p.time,
			'YYYY-MM-DD HH:mm:ss'
		);
	} else {
		date = now;
	}

	let humanDate = date.calendar(null, {
		lastDay: '[ieri]',
		sameDay: '[oggi]',
		nextDay: '[domani]',
		lastWeek: '[lo scorso] dddd',
		nextWeek: 'dddd [prossimo]',
		sameElse: 'L'
	});

	const tempo = date.isSame(now)
		? 'present'
		: date.isAfter(now)
		? 'future'
		: 'past';

	const data = await Wunderground.api({
		type: 'forecast',
		location: p.location
	});

	if (data.forecast == null || data.forecast.simpleforecast == null) {
		throw 'not_found';
	}

	const fores = data.forecast.simpleforecast.forecastday;
	if (fores == null) throw 'not_found';

	const obs = _.find(fores, o => {
		return o.date.epoch >= date.unix();
	});
	if (obs == null) throw 'not_found';

	if (p.request_type === 'condition') {
		const c = p.condition_description;
		const condition = extractWithPattern(
			fulfillmentMessages,
			`[].payload.conditions.${c}`
		);

		console.log('INTENT_TO_WG, c :', INTENT_TO_WG, c);
		const e = INTENT_TO_WG[c];
		if (e.indexOf(obs.icon) >= 0) {
			const _qualifier = WG_QUALIFIERS.find(q => obs.icon.indexOf(q) === 0);
			const qualifier = extractWithPattern(
				fulfillmentMessages,
				`[].payload.qualifiers.${_qualifier}`
			);
			return extractWithPattern(
				fulfillmentMessages,
				`[].payload.text.yes_${tempo}`
			)
				.replace('$_condition', condition)
				.replace('$_qualifier', qualifier)
				.replace('$_location', p.location)
				.replace('$_date', humanDate);
		} else {
			return extractWithPattern(
				fulfillmentMessages,
				`[].payload.text.no_${tempo}`
			)
				.replace('$_condition', condition)
				.replace('$_location', p.location)
				.replace('$_date', humanDate);
		}
	}

	if (p.request_type === 'explicit') {
		const avg_temp = (
			(parseInt(obs.high.celsius, 10) + parseInt(obs.low.celsius, 10)) /
			2
		).toFixed(0);
		return fulfillmentText
			.replace('$_location', p.location)
			.replace('$_conditions', obs.conditions)
			.replace('$_avg_temp', avg_temp)
			.replace('$_date', date);
	}
};
