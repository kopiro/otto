exports.id = 'messaging.sendto';

const ELIGIBLE_MIN_MUL = 2;

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		if (result.eligibileMultiple) {
			_.extend(p, { to: result.resolvedQuery });
		}

		ORM.Contact
		.find({ $text: { $search: p.to }}, { score: { $meta: "textScore" }})
		.sort({ score: { $meta:"textScore" } })
		.populate('session')
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
				if (contacts[0].score >= ELIGIBLE_MIN_MUL *  contacts[1].score) {
					eligible_contact = contacts[0];
				}
			}

			// Ask which of these is the contact to send the message
			if (eligible_contact == null) {
				return resolve({
					speech: `A quale di questi ${p.to} vuoi inviare il messaggio?`,
					data: {
						pending: {
							action: exports.id,
							data: _.extend(result, { eligibileMultiple: true })
						},
						replies: contacts.map((contact) => {
							return contact.name;
						})
					}
				});
			}

			// Finally send the message
			const eligible_contact_session = eligible_contact.sessions[0];

			IOManager.output({
				speech: `Hey! ${session_model.contact.name} mi ha detto di riferirti questo: ${p.text}`
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