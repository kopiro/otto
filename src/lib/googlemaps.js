const wifi = require('node-wifi');
const $ = require('@google/maps').createClient({
  key: config.gcloud.apiKey,
});

$.directionsWithAutomaticOrigin = async function (e) {
  wifi.init({ iface: 'en0' });
  const networks = await wifi.scan();
  $.geolocate({
    considerIp: true,
    wifiAccessPoints: networks.map(network => ({
      macAddress: network.bssid,
      signalStrength: 1 * network.signal_level,
      channel: network.channel,
    })),
  }, (err, locations) => {
    console.log(err, locations);
  });
};

module.exports = $;
