import fetch from "node-fetch";
import config from "../config";
import translator from "./translator";
import { Session as ISession } from "../types";

const _config = config().openai;

export default async function generate(question: string, session: ISession, _chatLog = ""): Promise<any> {
  const questionEng = await translator.translate(question, "en", session.getTranslateFrom());

  let chatLog = `${_chatLog}Human: ${questionEng}\nAI:`;
  const response = await fetch("https://api.openai.com/v1/engines/davinci/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${_config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt: chatLog,
      stop: ["\nHuman"],
      temperature: 0.9,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0.6,
      best_of: 1,
      max_tokens: 15,
    }),
  });

  const json = await response.json();
  const originalText = json.choices[0].text;
  chatLog += originalText + "\n";

  const text = await translator.translate(originalText, session.getTranslateTo(), "en");

  return { chatLog, text, originalText };
}
