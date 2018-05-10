exports.id = 'cirfood.book';

const CirFood = require('cir-food');
const CirFoodMem = {};

const _  = require('underscore');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;

console.log(result);

	if (session.settings.data.cirfood == null) {
		IOManager.input({
			session: session,
			params: {
				event: 'cirfood_configure'
			}
		});
		return;
	}

	let cirfood = CirFoodMem[ session.id ];

	// If cirfood is null,
	// it means that user is starting now to booking his lunch
	// (or server is crashed and node rebooted)
	if (cirfood == null) {

		cirfood = {};

		cirfood.client = new CirFood(
		session.settings.data.cirfood.username, 
		session.settings.data.cirfood.password
		);
		cirfood.date = p.date;
		cirfood.state = 0;

		await cirfood.client.startBooking(new Date(p.date));		

		CirFoodMem[session.id] = cirfood;

		IOManager.input({
			session: session,
			params: {
				event: 'cirfood_book_response'
			}
		});
		return;
	}

	const context_response = _.findWhere(result.contexts, {
		name: 'cirfood_book_response'
	});

	let course_mispelled = false;

	// The user responsd from a question of the bot
	if (context_response != null)  {
		// Find the answer into replies
		const courses = cirfood.client.booking.courses[cirfood.state].data;
		const selected_course = courses.find(e => {
			return e.text === result.resolvedQuery || e.id === result.resolvedQuery;
		});

		if (selected_course != null) {
			cirfood.client.addCourseToCurrentBooking(selected_course.id);
			cirfood.state++;
		} else {
			course_mispelled = true;
		}
	}

	if (cirfood.state <= 2) {
		return {
			speech: fulfillment
			.payload
			.speechs
			.available_courses
			.replace('$_state', (1 + cirfood.state))
			.replace('$_date', cirfood.date),
			data: {
				forceText: true,
				replies: cirfood.client.booking.courses[cirfood.state].data
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