exports.id = 'messaging.sendto';

const _ = require('underscore');

const ELIGIBLE_MIN_MUL = 2;

module.exports = function({ sessionId, result }, session) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Data.Session
		.find({ $text: { $search: p.to }}, { score: { $meta: 'textScore' }})
		.sort({ score: { $meta: 'textScore' } })
		.then(async(contacts) => {

			// If no contact is found, inform the user
			if (contacts.length === 0) {
				return resolve({
					speech: `Non riesco a trovare ${p.to} nei contatti`
				});
			}

			let eligible_contact = null;

			// If the difference from the first to the second is massive, splice manually
			if (contacts.length === 1) {
				eligible_contact = contacts.first();
			} else {
				if (contacts[0].score >= ELIGIBLE_MIN_MUL *  contacts[1].score) {
					eligible_contact = contacts[0];
				}
			}

			// Ask which of these is the contact to send the message
			if (eligible_contact == null) {
				session.saveInPipe({
					messaging_sendto_multiplecontacts: {
						text: p.text
					}
				});
				return resolve({
					speech: `A quale di questi "${p.to}" vuoi inviare il messaggio?`,
					contextOut: [
						{ name: "messaging_sendto_multiplecontacts", lifespan: 1 }
					],
					data: {
						replies: contacts.map((contact) => contact.alias)
					}
				});
			}

			let text;
			if (session.getPipe().messaging_sendto_multiplecontacts) {
				text = session.getPipe().messaging_sendto_multiplecontacts.text;
			} else {
				text = p.text;
			}

			try {
				await IOManager.input({
					params: { fulfillment: {
						speech: `Hey! ${session.alias} mi ha detto di riferirti questo: ${text}`
					} },
					session: eligible_contact
				});
				resolve({
					speech: 'Perfetto, inviato!'
				});
			} catch (err) {
				reject(err);
			}

		})
		.catch(reject);
	});
};