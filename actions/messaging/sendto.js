exports.id = 'messaging.sendto';

const ELIGIBLE_MIN_MUL = 2;

let requests = {};

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Memory.Contact.search(p.to, {
			withRelated: ['sessions']
		})
		.then((contacts) => {

			// Extend a previous request
			// This can happens when the messaging_sendto_multiplecontacts context is used
			if (p.extend_previous) {
				if (requests[sessionId] != null) {
					_.extend(p, requests[sessionId].parameters);
					delete requests[sessionId];
				}
			}

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
				requests[ sessionId ] = { 
					parameters: { 
						text: p. text 
					} 
				};
				return resolve({
					speech: `A quale di questi ${p.to} vuoi inviare il messaggio?`,
					contextOut: [
					{ name: "messaging_sendto_multiplecontacts", lifespan: 1 }
					],
					data: {
						replies: contacts.map((contact) => {
							return contact.getUniqueName(); 
						})
					}
				});
			}

			// Finally send the message
			const IOManager = require(__basedir + '/iomanager');
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

		console.log(p);
	});
};