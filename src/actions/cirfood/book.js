exports.id = 'cirfood.book';

const CirFood = require('cir-food');
const CirFoodMem = {};

const _  = require('underscore');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;

	if (session.settings.cirfood == null) {
		IOManager.input({
			session: session,
			params: {
				event: 'cirfood_configure'
			}
		});
		return;
	}

	let cirfood = CirFoodMem[ session.id ];

	// If cirfood (CirFoodMem[ session.id ]) is null,
	// it means that user is starting now to booking his lunch
	// (or server is crashed and node rebooted)
	if (cirfood == null) {

		cirfood = {};

		cirfood.client = new CirFood(
		session.settings.cirfood.username, 
		session.settings.cirfood.password
		);
		cirfood.date = p.date;
		cirfood.state = 0;

		await cirfood.client.startBooking(new Date(p.date));		

		CirFoodMem[session.id] = cirfood;

		// Exit from this intent
		// bacause we don't have enough data in this intent
		// to process speechs, switch to cirfood_book_response instead
		IOManager.input({
			session: session,
			params: {
				event: 'cirfood_book_response'
			}
		});
		return;
	}

	let course_mispelled = false;

	const context_response = _.findWhere(result.contexts, {
		name: 'cirfood_book_response'
	});

	// The user responsd from a question of the bot
	if (context_response != null)  {
		// Find the answer into replies
		const courses = cirfood.client.booking.courses[cirfood.state].data;
		const selected_course = courses.find(e => {
			return e.text === result.resolvedQuery || e.hid === result.resolvedQuery;
		});

		if (selected_course != null) {
			cirfood.client.addCourseToCurrentBooking(selected_course.id);
			cirfood.state++;
		} else {
			course_mispelled = true;
		}
	}

	if (cirfood.state <= 2) {

		let speech = fulfillment
		.payload
		.speechs
		.available_courses
		.replace('$_state', (1 + cirfood.state))
		.replace('$_date', cirfood.date);
		speech += "\n";
		speech += cirfood.client.booking.courses[cirfood.state].data.map(e => (e.hid + '. ' + e.text)).join("\n");

		return {
			speech: speech,
			data: {
				forceText: true,
				replies: cirfood.client.booking.courses[cirfood.state].data.map(e => e.hid)
			},
			contextOut: [
			{ name: "cirfood_book_response", lifespan: 1 }
			]
		};
	}

	// Book here
	cirfood.client.submitCurrentBooking();
	delete CirFoodMem[session.id];
	
	return {
		speech: fulfillment.payload.speechs.done
	};
};