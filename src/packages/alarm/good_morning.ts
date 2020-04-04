import { extractWithPattern, rand } from "../../helpers";

export const id = "alarm.good_morning";

const CONTEXT_QUESTION = "good_morning_question";

function handleMathProduct(question) {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  question.answers = [String(a * b)];
  question.text = question.text.replace("$_a", a).replace("$_b", b);
  return question;
}

function handleMathSum(question) {
  const a = 1 + Math.floor(Math.random() * 100);
  const b = 1 + Math.floor(Math.random() * 100);
  question.answers = [String(a + b)];
  question.text = question.text.replace("$_a", a).replace("$_b", b);
  return question;
}

export default async function* main({ queryResult }, session) {
  const { fulfillmentText, fulfillmentMessages } = queryResult;

  if (fulfillmentText) {
    yield fulfillmentText;
  }

  const questions = extractWithPattern(fulfillmentMessages, "[].payload.questions");
  if (questions) {
    let question = rand(questions);
    switch (question.kind) {
      case "math.product":
        question = handleMathProduct(question);
        break;
      case "math.sum":
        question = handleMathSum(question);
        break;
      default:
        return;
    }

    await session.savePipe({
      good_morning_question: question,
    });

    yield {
      fulfillmentText: question.text,
      outputContexts: [
        {
          name: CONTEXT_QUESTION,
          lifespanCount: 1,
        },
      ],
    };
  }
}
