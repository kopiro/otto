import openai from "../../stdlib/ai/openai";
import { AIAction } from "../../types";

export const id = "draw";

const draw: AIAction = async ({ queryResult }, session) => {
  const { parameters } = queryResult;
  const image = await openai().imageRequest(parameters.fields.query.stringValue, session);

  return {
    image,
  };
};

export default draw;
