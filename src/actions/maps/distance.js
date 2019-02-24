exports.id = 'maps.distance';

const GoogleMaps = requireLibrary('googlemaps');
const Moment = requireLibrary('moment');
const { promisify } = require('util');

module.exports = async function ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  const response = await promisify(GoogleMaps.directions)(p);

  const distance = response.json.routes[0].legs[0].distance.text;
  const duration = response.json.routes[0].legs[0].duration.value;
  const duration_human = Moment.duration(duration * 1000).humanize();

  return fulfillmentText
    .replace('$_distance', distance)
    .replace('$_duration', duration_human);
};
