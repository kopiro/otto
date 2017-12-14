exports.id = 'torrent.download';

const _ = require('underscore');

const TorrentSE = apprequire('torrent/se');
const Transmission = apprequire('torrent/transmission');

const pendingQueue = {};

module.exports = function({ sessionId, result }, session) {
	return new Promise(async(resolve, reject) => {
		const { parameters: p, fulfillment } = result;

		let torrents;
		const ctx_multiple_items = _.findWhere(result.contexts, { name: 'torrent_multipleitems' });
		
		if (ctx_multiple_items && pendingQueue[sessionId]) {
			let index = 1;
			const answer = _.find(pendingQueue[sessionId], (torrent) => {
				console.error(torrent, result.resolvedQuery);
				return (torrent.title === result.resolvedQuery || index++ == result.resolvedQuery);
			});

			if (answer == null) {
				return resolve({
					speech: 'Scusami, ma non mi sembra uno della lista 😳'
				});
			}

			torrents = [ answer ];

		} else {
			torrents = await TorrentSE.query(p.q);
		}

		if (torrents.length === 0) {
			return resolve({
				speech: 'Scusa, ma questa cosa non riesco a trovarla 😔'
			});
		}

		// If list is one value, instant resolve!
		// This could happen if the user is very specific about something
		// or if the context of multiple items is set
		if (torrents.length === 1) {
			const answer = torrents[0];
			console.log(answer);
			return Transmission.addUrl(answer.magnet, (err, arg) => {
				if (err) return reject({ speech: err });
				resolve({
					speech: 'Ok, messo a scaricare ' + answer.title + '!'
				});
			});
		}

		let speech;
		const torrents_speech = torrents.map((e,i) => ((i+1) + ' - ' + e.title)).join("\n");
		if (torrents.length > 5) {
			speech = 'Ci sono troppe cose con il nome ' + p.q + 
			'. Ne ho trovate ben ' + torrents.length + '; quale vuoi scaricare?' + "\n\n" + torrents_speech;
		} else {
			speech = 'Scusami ma non riesco a decidere tra questi ' + torrents.length + '; quale vuoi scaricare?' + "\n\n" + torrents_speech;
		}

		pendingQueue[sessionId] = torrents;

		resolve({
			speech: speech,
			contextOut: [
				{ name: "torrent_multipleitems", lifespan: 1, parameters: p }
			],
			data: {
				replies: torrents.map((e) => e.title),
			}
		});			

	});
};