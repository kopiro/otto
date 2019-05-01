exports.id = 'e.book';

const CirFood = require('cir-food');
const stringSimilarity = require('string-similarity');
const { extractWithPattern } = require('../helpers');

const pendingQueue = {};

const CONTEXT_CONFIGURE = 'cirfood_configure';
const CONTEXT_BOOK_YES = 'cirfood_book_yes';
const CONTEXT_BOOK_RESPONSE = 'cirfood_book_response';
const COURSES_MAX = 3;

module.exports = async function main({ queryResult }, session) {
  const {
    parameters: p, fulfillmentText, queryText, fulfillmentMessages,
  } = queryResult;

  if (session.settings.cirfood == null) {
    return {
      followupEventInput: {
        name: CONTEXT_CONFIGURE,
      },
    };
  }

  if (p.startBooking) {
    return {
      followupEventInput: {
        name: CONTEXT_BOOK_RESPONSE,
      },
    };
  }

  const e = pendingQueue[session.id] || {};
  let text = '';
  let selectedCourse;

  if (p.bookingInProcess == null) {
    e.client = new CirFood(session.settings.cirfood.username, session.settings.cirfood.password);
    e.date = p.date;
    e.menu = null;
    e.booking = [];

    await e.client.startBooking(new Date(e.date));
    pendingQueue[session.id] = e;

    text = `${fulfillmentText}\n\n`;
    for (const c of e.client.booking.courses) {
      text += `+++++++++ ${c.kind} +++++++++\n`;
      for (const e of c.data) {
        text += `${e.text}\n`;
      }
      text += '\n';
    }

    return {
      fulfillmentText: text,
      outputContexts: [
        {
          name: CONTEXT_BOOK_YES,
          lifespanCount: 1,
        },
      ],
    };
  }

  if (e.booking.length < COURSES_MAX) {
    // Find the answer into replies
    const courses = e.client.booking.courses[e.booking.length].data;

    if (e.menu) {
      // If we are in a state > 0, check queryText to match
      selectedCourse = courses.find(e => e.hid === queryText);

      // If we didn't found a course by ID, use levenshtein
      if (selectedCourse == null) {
        console.debug(exports.id, 'Unable to identify a course by ID, use best match');
        const matches = stringSimilarity.findBestMatch(queryText, courses.map(e => e.text));
        if (matches.bestMatch != null) {
          selectedCourse = courses.find(e => e.text === matches.bestMatch.target);
        }
      }

      if (selectedCourse != null) {
        // Add course to booking because we found it
        await e.client.addCourseToCurrentBooking(selectedCourse.id);
        // Increment state to go to next course
        e.booking.push(selectedCourse);
        text += extractWithPattern(fulfillmentMessages, '[].payload.text.available_courses');
        text = text.replace('$_course', selectedCourse.text);
      } else {
        text += extractWithPattern(fulfillmentMessages, '[].payload.text.available_courses_again');
      }
    } else {
      text += extractWithPattern(fulfillmentMessages, '[].payload.text.available_courses');
    }

    text = text.replace('$_state', 1 + e.booking.length);
    text = text.replace('$_date', e.date);

    if (e.booking.length < COURSES_MAX) {
      e.menu = e.client.booking.courses[e.booking.length].data;
      // Add current menu
      text += '\n\n';
      text += e.menu.map(_ => `${_.hid}. ${_.text}`).join('\n');

      // Return to WH by passing outputContexts to CONTEXT_BOOK_RESPONSE
      return {
        fulfillmentText: text,
        payload: {
          forceText: true,
          replies: e.menu ? e.menu.map(_ => _.hid) : [],
        },
        outputContexts: [
          {
            name: CONTEXT_BOOK_RESPONSE,
            lifespanCount: 1,
          },
        ],
      };
    }
  }

  // We reached booking.length > COURSES_MAX, then finalize booking
  await e.client.submitCurrentBooking();

  delete pendingQueue[session.id];

  return fulfillmentText;
};
