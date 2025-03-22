export const $ = (selector: string) => document.querySelector(selector);
export const $$ = (selector: string) => document.querySelectorAll(selector);

const $messages = $("#messages") as HTMLDivElement;
const $aiAudio = $("#ai-audio") as HTMLAudioElement;
const $userAudio = $("#user-audio") as HTMLAudioElement;
const $inputPerson = $("#person") as HTMLInputElement;

export function cleanMessages() {
  $messages.innerHTML = "";
}

export function addMessage(
  author: string,
  text: string,
  className: string,
  createdAt: string = new Date().toISOString(),
) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${className}`;

  // Create header with author and date
  const headerDiv = document.createElement("div");
  headerDiv.className = "message-header";

  const authorDiv = document.createElement("div");
  authorDiv.className = "message-author";
  authorDiv.textContent = author;
  headerDiv.appendChild(authorDiv);

  const dateDiv = document.createElement("div");
  dateDiv.className = "message-date";
  const date = new Date(createdAt);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  dateDiv.textContent = isToday
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  headerDiv.appendChild(dateDiv);

  // Create text content
  const textDiv = document.createElement("div");
  textDiv.className = "message-text";
  textDiv.textContent = text;

  // Assemble message
  messageDiv.appendChild(headerDiv);
  messageDiv.appendChild(textDiv);
  $messages.appendChild(messageDiv);

  // Scroll down the chat
  $messages.scrollTop = $messages.scrollHeight;
}

export async function apiIOWeb(body: string | FormData) {
  try {
    const response = await fetch("/io/web", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-person": localStorage.getItem("auth"),
      },
      body: body,
    });

    const json = await response.json();

    if (json.error) {
      addMessage("CONTROL CENTER", json.error.message, "output error");
      return;
    }

    const { output, voice } = json;
    addMessage("AI", output.text, "output");

    if (voice) {
      $aiAudio.src = voice;
      $aiAudio.volume = 1;
      $aiAudio.play();
    }
  } catch (err) {
    console.error(err);
  }
}

export async function userTextToSpeech(text: string) {
  $userAudio.src = "";
  $userAudio.volume = 0;
  $userAudio.play();

  const url = new URL("/api/user-speech", location.href);
  url.search = new URLSearchParams({ text, gender: "male", person: $inputPerson.value }).toString();

  $userAudio.src = url.toString();

  $userAudio.volume = 1;
  $userAudio.play();
}

export async function aiTextToSpeech(text: string) {
  $aiAudio.src = "";
  $aiAudio.volume = 0;
  $aiAudio.play();

  const url = new URL("/api/speech", location.href);
  url.search = new URLSearchParams({
    text,
    "x-auth-person": localStorage.getItem("auth"),
  }).toString();

  $aiAudio.src = url.toString();

  $aiAudio.volume = 1;
  $aiAudio.play();
}
