exports.id = 'messaging.sendto';

const ELIGIBLE_MIN_MUL = 2;

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		if (p.eligibileMultiple) {
			delete p.eligibileMultiple;
			_.extend(p, { to: result.resolvedQuery });
		}

		ORM.Contact.search(p.to, {
			withRelated: ['sessions']
		})
		.then((contacts) => {

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
				if (contacts.at(0).get('score') >= ELIGIBLE_MIN_MUL *  contacts.at(1).get('score')) {
					eligible_contact = contacts.at(0);
				}
			}

			// Ask which of these is the contact to send the message
			if (eligible_contact == null) {
				return resolve({
					speech: `A quale di questi ${p.to} vuoi inviare il messaggio?`,
					data: {
						pending: {
							action: exports.id,
							data: _.extend(p, { eligibileMultiple: true })
						},
						replies: contacts.map((contact) => {
							return contact.getUniqueName(); 
						})
					}
				});
			}

			// Finally send the message
			const eligible_contact_session = eligible_contact.related('sessions').first();
			const from_name = session_model.get('first_name');

			IOManager.output({
				speech: `${from_name} voleva dirti: ${p.text}`
			}, eligible_contact_session)
			.then(() => {
				resolve({
					speech: fulfillment.speech
				});
			})
			.catch(reject);

		})
		.catch(reject);
	});
};