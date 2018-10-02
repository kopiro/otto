exports.id = 'cirfood.book_detect';

const CirFood = require('cir-food');
const CirFoodMem = {};

const _ = require('underscore');
const stringSimilarity = require('string-similarity');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;

	if (session.settings.cirfood == null) {
		IOManager.handle({
			session: session,
			params: {
				event: 'cirfood_configure'
			}
		});
		return;
	}

	let cirfood = {};

	cirfood.client = new CirFood(session.settings.cirfood.username, session.settings.cirfood.password);
	cirfood.date = p.date;

	await cirfood.client.startBooking(new Date(cirfood.date));		

	const courses = cirfood.client.booking.courses;
	const past_bookings = session.settings.cirfood_bookings;

	for (let course of courses) {
		for (let meal of course.data) {
			meal.score = meal.score || 0;
			for (let past_booking of Object.values(past_bookings)) {
				for (let past_meal of past_booking) {
					meal.score += stringSimilarity.compareTwoStrings(past_meal.text, meal.text);
				}
			}
		}
	}
	
	const detected_courses = courses.map(course => {
		return course.data.sort((a,b) => (b.score - a.score))[ 0 ];
	});

	try {

		for (let course of detected_courses) {
			await cirfood.client.addCourseToCurrentBooking(course.id);
		}
		await cirfood.client.submitCurrentBooking();

	} catch (err) {
		console.error(exports.id, err);
		return fulfillment.payload.error;
	}

	session.settings.cirfood_bookings_detected = session.settings.cirfood_bookings || {};
	session.settings.cirfood_bookings_detected[cirfood.date] = detected_courses;
	session.markModified('settings');
	session.save();

	const speech = fulfillment.speech
	.replace('$_date', p.date)
	.replace('$_courses', detected_courses.map(e => e.text).join(", "));
	
	return {
		speech: speech
	};
};