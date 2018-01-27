const TAG = 'ChromeCast';

const _config = config.chromecast;

const CastClient = require('castv2-client').Client;
const mdns = require('mdns');

// Fix for RPI
mdns.Browser.defaultResolverSequence[1] = 'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[4]});

exports.connect = function(chromecast_id) {
	return new Promise((resolve, reject) => {
		const browser = mdns.createBrowser(mdns.tcp('googlecast'));
		browser.on('serviceUp', (service) => {
			console.debug(TAG, 'found device ' + service.txtRecord.fn);
			
			if (service.name == chromecast_id) {
				console.debug(TAG, 'found default device');
				browser.stop();

				const castClient = new CastClient();
				castClient.name = service.txtRecord.fn;

				castClient.connect(service.addresses[0], () => {
					console.log(TAG, 'connected to ' + castClient.name);
					resolve(castClient);
				});

				castClient.on('error', function(err) {
					console.error(TAG, err.message);
					castClient.close();
					reject(err);
				});

			}
		});
		browser.start();
	});
};

