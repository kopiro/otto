const TAG = 'Scheduler/MonitorDevicesAndAnnounce';
const ping = require('ping');

exports.run = function(sch) {
	sch.data.hosts.forEach((host) => {
		ping.sys.probe(host.hostname, function(alive1) {
			// Double check
			setTimeout(() => {
				ping.sys.probe(host.hostname, function(alive2) {
					if (alive1 != alive2) {
						console.warn(TAG, 'inconsistent data, checking next time');
						return;
					}

					if (host.alive == alive2) return;

					host.alive = alive2;

					sch.markModified('data');
					sch.save();

					if (host.alive) {
						setTimeout(() => {
							IOManager.output({ 
								speech: 'Ciao ' + host.name + ', bentornato a casa!'
							}, sch.session);
						}, 10000);
					} else {
						IOManager.output({ 
							speech: 'Ciao ' + host.name + ', a dopo!'
						}, sch.session);
					}
				});
			}, 500);
		});
	});
};