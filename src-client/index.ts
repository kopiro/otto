import Recorder from "recorder-js";

declare let webkitAudioContext: any; // ADDED

const formConversation = document.querySelector("#conversation") as HTMLFormElement;
const formRepeat = document.querySelector("#repeat") as HTMLFormElement;
const formAdmin = document.querySelector("#admin") as HTMLFormElement;

const inputAuth = document.querySelector("#auth") as HTMLInputElement;
const inputPerson = document.querySelector("#person") as HTMLInputElement;
const inputTextToSpeechOutput = document.querySelector("#text-to-speech") as HTMLInputElement;

const inputUserTextToSpeech = document.querySelector("#user-text-to-speech") as HTMLInputElement;
const inputGender = document.querySelector("#user-gender") as HTMLInputElement;

const aiAudio = document.querySelector("#ai-audio") as HTMLAudioElement;
const userAudio = document.querySelector("#user-audio") as HTMLAudioElement;

const messages = document.getElementById("messages") as HTMLDivElement;
const recordStartBtn = document.getElementById("record-start");
const recordStopBtn = document.getElementById("record-stop");

async function userTextToSpeech(text: string, gender: string) {
  userAudio.src = "";
  userAudio.volume = 0;
  userAudio.play();

  const url = new URL("/api/user-speech", location.href);
  url.search = new URLSearchParams({ text, gender, person: inputPerson.value }).toString();

  userAudio.src = url.toString();

  userAudio.volume = 1;
  userAudio.play();
}

async function aiTextToSpeech(text: string) {
  aiAudio.src = "";
  aiAudio.volume = 0;
  aiAudio.play();

  const url = new URL("/api/speech", location.href);
  url.search = new URLSearchParams({ text, person: inputPerson.value }).toString();

  aiAudio.src = url.toString();

  aiAudio.volume = 1;
  aiAudio.play();
}

function addMessage(text: string, className: string) {
  const div = document.createElement("div");
  div.className = `message ${className}`;
  div.textContent = text;
  messages.appendChild(div);

  // Scroll down the chat
  messages.scrollTop = messages.scrollHeight;
}

async function sendData(body) {
  try {
    const response = await fetch("/io/web", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-person": inputAuth.value,
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
      aiAudio.src = voice;
      aiAudio.volume = 1;
      aiAudio.play();
    }
  } catch (err) {
    console.error(err);
  }
}

formRepeat.addEventListener("submit", (e) => {
  e.preventDefault();

  const textInputEl = formRepeat.querySelector("input[type=text]") as HTMLInputElement;
  if (!textInputEl.value) return;

  aiTextToSpeech(textInputEl.value);

  textInputEl.value = "";
});

document.querySelector("#brain-reload").addEventListener("click", async (e) => {
  document.querySelector("#brain-reload").setAttribute("disabled", "disabled");

  await fetch("/api/admin/brain_reload", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-person": inputAuth.value,
    },
    body: JSON.stringify({
      types: ["prompt", "declarative", "social"],
    }),
  });

  document.querySelector("#brain-reload").removeAttribute("disabled");

  alert("Brain reloaded");
});

formConversation.addEventListener("submit", (e) => {
  e.preventDefault();

  aiAudio.src = "";
  aiAudio.volume = 0;
  aiAudio.play();

  const textInputEl = formConversation.querySelector("input[type=text]") as HTMLInputElement;
  if (!textInputEl.value) return;

  addMessage(textInputEl.value, "input");

  if (inputUserTextToSpeech.checked) {
    userTextToSpeech(textInputEl.value, inputGender.value);
  }

  sendData(
    JSON.stringify({
      params: { text: textInputEl.value },
      person: inputPerson.value,
      text_to_speech: inputTextToSpeechOutput.checked,
    }),
  );

  textInputEl.value = "";
});

let recorder;

recordStartBtn.addEventListener("click", async () => {
  recorder = new Recorder(new (window.AudioContext || window.webkitAudioContext)());

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  await recorder.init(stream);
  await recorder.start();

  recordStopBtn.removeAttribute("disabled");
  recordStartBtn.setAttribute("disabled", "disabled");
});

recordStopBtn.addEventListener("click", async () => {
  const { blob } = await recorder.stop();
  recordStartBtn.removeAttribute("disabled");
  recordStopBtn.setAttribute("disabled", "disabled");

  const fd = new FormData();
  fd.append("audio", blob);

  sendData(fd);
});

inputAuth.value = localStorage.getItem("auth") || "";
inputAuth.addEventListener("change", () => {
  localStorage.setItem("auth", inputAuth.value);
});

inputPerson.value = localStorage.getItem("person") || "";
inputPerson.addEventListener("change", () => {
  localStorage.setItem("person", inputPerson.value);
});
