export const $ = (selector: string) => document.querySelector(selector);
export const $$ = (selector: string) => document.querySelectorAll(selector);

const $messages = $("#messages") as HTMLDivElement;
const $aiAudio = $("#ai-audio") as HTMLAudioElement;
const $userAudio = $("#user-audio") as HTMLAudioElement;
const $inputPerson = $("#person") as HTMLInputElement;

export function addMessage(text: string, className: string) {
  const div = document.createElement("div");
  div.className = `message ${className}`;
  div.textContent = text;
  $messages.appendChild(div);

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

    const { output, error, voice } = json;

    if (error) {
      addMessage(error.message, "output error");
      return;
    }

    addMessage(output.text, "output");

    if (voice) {
      $aiAudio.src = voice;
      $aiAudio.volume = 1;
      $aiAudio.play();
    }
  } catch (err) {
    console.error(err);
  }
}

export async function userTextToSpeech(text: string, gender: string) {
  $userAudio.src = "";
  $userAudio.volume = 0;
  $userAudio.play();

  const url = new URL("/api/user-speech", location.href);
  url.search = new URLSearchParams({ text, gender, person: $inputPerson.value }).toString();

  $userAudio.src = url.toString();

  $userAudio.volume = 1;
  $userAudio.play();
}

export async function aiTextToSpeech(text: string) {
  $aiAudio.src = "";
  $aiAudio.volume = 0;
  $aiAudio.play();

  const url = new URL("/api/speech", location.href);
  url.search = new URLSearchParams({ text, person: $inputPerson.value }).toString();

  $aiAudio.src = url.toString();

  $aiAudio.volume = 1;
  $aiAudio.play();
}
