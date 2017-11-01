exports.id = 'torrent.download';

const se = apprequire('torrent/se');



module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;

		if (result.isAnswer === true && result.torrents != null) {
			
			const answer = IOManager.processResponseToPendingAnswer(result.torrents, result.resolvedQuery);

			if (answer == null) {
				return resolve({
					speech: 'Non è nella lista...'
				});
			}

			return resolve({
				speech: 'Ok, metto a scaricare ' + answer.title + '!'
			});

		}

		se.query(p.q)
		.then((torrents) => {

			if (torrents.length === 0) {
				return resolve({
					speech: 'Scusa, ma questa cosa non riesco a trovarla :('
				});
			}

			if (torrents.length === 1) {
				const answer = torrents[0];
				return resolve({
					speech: 'Ok, metto a scaricare ' + answer.title + '!'
				});
			}


			session_model.saveInPipe({ nextOutputWithVoice: false });

			let speech;
			const torrents_speech = torrents.map((e,i) => (i+1) + '. ' + e.title + '.').join("\n");
			if (torrents.length > 5) {
				speech = 'Ci sono troppe cose con il nome ' + p.q + 
				'. Ne ho trovate ben ' + torrents.length + '; quale vuoi scaricare?' + "\n\n" + torrents_speech 
			} else {
				speech = 'Scusami ma non riesco a decidere tra questi ' + torrents.length + '; quale vuoi scaricare?' + "\n\n" + torrents_speech;
			}

			return resolve({
				speech: speech,
				data: {
					replies: torrents.map((e) => e.title),
					pending: {
						action: exports.id,
						data: _.extend(result, { 
							isAnswer: true,
							torrents: torrents
						}),
					}
				}
			});			

		})
		.catch(reject);

	});
};