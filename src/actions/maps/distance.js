exports.id = 'maps.distance';

const GoogleMaps = require('../../lib/googlemaps');
const Moment = require('../../lib/moment');
const { promisify } = require('util');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  const response = await promisify(GoogleMaps.directions)(p);

  const distance = response.json.routes[0].legs[0].distance.text;
  const duration = response.json.routes[0].legs[0].duration.value;
  const duration_human = Moment.duration(duration * 1000).humanize();

  return fulfillmentText.replace('$_distance', distance).replace('$_duration', duration_human);
};
