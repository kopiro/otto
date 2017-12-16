var Client                = require('castv2-client').Client;
var Youtube               = require('youtube-castv2-client').Youtube;
var mdns                  = require('mdns');

// Fix for RPI
mdns.Browser.defaultResolverSequence[1] = 'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[4]});

var browser = mdns.createBrowser(mdns.tcp('googlecast'));

browser.on('serviceUp', function(service) {
  console.log(`found device <${service.name}>`);
  ondeviceup(service.addresses[0]);
  browser.stop();
});

browser.start();

function ondeviceup(host) {

  var client = new Client();
  client.connect(host, function() {
    console.log('connected, launching app ...');
    client.launch(Youtube, function(err, player) {
      player.load('69V__a49xtw', () => {});
    });
  });

  client.on('error', function(err) {
    console.log('Error: %s', err.message);
    client.close();
  });

}