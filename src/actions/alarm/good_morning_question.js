exports.id = 'alarm.good_morning_question';

const { extractWithPattern } = require('../../helpers');

const CONTEXT_QUESTION = 'good_morning_question';

module.exports = async function main({ queryResult }, session) {
  const { fulfillmentMessages, queryText } = queryResult;

  const question = session.pipe.good_morning_question;
  if (question == null) return null;

  if (question.answers.indexOf(queryText.toLowerCase()) >= 0) {
    const e = extractWithPattern(fulfillmentMessages, '[].payload.correct');
    // Zerofy contexts
    e.outputContexts = [
      {
        name: CONTEXT_QUESTION,
        lifespanCount: 0,
      },
    ];
    return e;
  }

  const e = extractWithPattern(fulfillmentMessages, '[].payload.wrong');
  e.fulfillmentText = e.fulfillmentText.replace('$_question', question.text);
  e.outputContexts = [
    {
      name: CONTEXT_QUESTION,
      lifespanCount: 1,
    },
  ];
  return e;
};
