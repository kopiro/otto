exports.id = 'cirfood.book';

const CirFood = require('cir-food');
const CirFoodMem = {};

const _ = require('underscore');
const stringSimilarity = require('string-similarity');

module.exports = async function ({
	sessionId,
	result
}, session) {
	let {
		parameters: p,
		fulfillment
	} = result;

	if (session.settings.cirfood == null) {
		return await AI.eventRequest('cirfood_configure', session);
	}

	const context_response = _.findWhere(result.contexts, {
		name: 'cirfood_book_response'
	});

	if (context_response == null || CirFoodMem[session.id] == null) {
		let cirfood = {};

		cirfood.client = new CirFood(session.settings.cirfood.username, session.settings.cirfood.password);
		cirfood.date = p.date;
		cirfood.state = -1;
		cirfood.booking = [];

		await cirfood.client.startBooking(new Date(cirfood.date));

		// Exit from this intent
		// bacause we don't have enough data in this intent
		// to process speechs, switch to cirfood_book_response instead
		IOManager.handle({
			session: session,
			params: {
				event: 'cirfood_book_response'
			}
		});

		let text = "";
		for (let c of cirfood.client.booking.courses) {
			text += "---" + c.kind + "---\n";
			for (let e of c.data) {
				text += e.text + "\n";
			}
		}

		CirFoodMem[session.id] = cirfood;

		return {
			speech: text
		};
	}

	let cirfood = CirFoodMem[session.id];
	let do_course_parsing = true;
	let selected_course;
	let again = false;

	if (cirfood.state === -1) {
		do_course_parsing = false;
		cirfood.state = 0;
	}

	// Find the answer into replies
	const courses = cirfood.client.booking.courses[cirfood.state].data;

	if (do_course_parsing) {
		selected_course = courses.find(e => {
			return e.hid === result.resolvedQuery;
		});

		// If we didn't found a course by ID, use levenshtein
		if (selected_course == null) {
			console.debug(exports.id, 'Unable to identify a course by ID, use best match');
			const matches = stringSimilarity.findBestMatch(result.resolvedQuery, courses.map(e => e.text));
			if (matches.bestMatch != null) {
				selected_course = courses.find(e => (e.text === matches.bestMatch.target));
			}
		}

		if (selected_course != null) {

			try {
				await cirfood.client.addCourseToCurrentBooking(selected_course.id);
			} catch (err) {
				console.error(exports.id, err);
				return fulfillment.payload.error;
			}

			cirfood.state++;
			cirfood.booking.push(selected_course);

		} else {
			again = true;
		}
	}

	if (cirfood.state <= 2) {

		let speech = "";

		if (selected_course != null) {
			speech = fulfillment.payload.speechs.available_courses_step_done;
			speech = speech.replace('$_course', selected_course.text);
		} else {
			speech = fulfillment.payload.speechs[again ? "available_courses_again" : "available_courses"];
		}

		speech = speech
			.replace('$_state', (1 + cirfood.state))
			.replace('$_date', cirfood.date);

		speech += "\n" + cirfood.client.booking.courses[cirfood.state].data.map(e => (e.hid + '. ' + e.text)).join("\n");

		return {
			speech: speech,
			data: {
				forceText: true,
				replies: cirfood.client.booking.courses[cirfood.state].data.map(e => e.hid)
			},
			contextOut: [{
				name: "cirfood_book_response",
				lifespan: 1
			}]
		};
	}

	// Book here
	try {
		await cirfood.client.submitCurrentBooking();
	} catch (err) {
		console.error(exports.id, err);
		return fulfillment.payload.error;
	}

	session.settings.cirfood_bookings = session.settings.cirfood_bookings || {};
	session.settings.cirfood_bookings[cirfood.date] = cirfood.booking;
	session.markModified('settings');
	session.save();

	delete CirFoodMem[session.id];

	return {
		speech: fulfillment.payload.speechs.done
	};
};