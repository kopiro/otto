import Recorder from "recorder-js";

declare let webkitAudioContext: any; // ADDED

const formConversation = document.querySelector("#conversation") as HTMLFormElement;
const formEvent = document.querySelector("#event") as HTMLFormElement;
const formRepeat = document.querySelector("#repeat") as HTMLFormElement;

const inputSessionId = document.querySelector("#sessionid") as HTMLInputElement;
const inputLanguage = document.querySelector("#language") as HTMLInputElement;

const audio = document.querySelector("audio") as HTMLAudioElement;
const responseTextarea = document.getElementById("response") as HTMLTextAreaElement;
const recordStartBtn = document.getElementById("record-start");
const recordStopBtn = document.getElementById("record-stop");

async function repeatTextToSpeech(text: string, language: string) {
  audio.src = "";
  audio.volume = 0;
  audio.play();

  const url = new URL("/api/speech", location.href);
  url.search = new URLSearchParams({ text, language }).toString();

  responseTextarea.value = text;

  audio.src = url.toString();

  audio.volume = 1;
  audio.play();
}

async function sendData(headers, body) {
  audio.src = "";
  audio.volume = 0;
  audio.play();

  const response = await fetch("/io/web", {
    method: "POST",
    headers: {
      ...headers,
      Accept: "text, audio",
    },
    body: body,
  });

  const json = await response.json();

  if (json.error) {
    responseTextarea.style.color = "red";
    responseTextarea.value = json.error?.message ?? JSON.stringify(json);
  } else {
    responseTextarea.style.color = "white";
    if (json.text) {
      responseTextarea.value = json.text;
    }
    if (json.audio) {
      audio.src = json.audio;
      audio.volume = 1;
      audio.play();
    }
  }
}

formRepeat.addEventListener("submit", (e) => {
  e.preventDefault();

  const textInputEl = formRepeat.querySelector("input[type=text]") as HTMLInputElement;
  if (!textInputEl.value) return;

  repeatTextToSpeech(textInputEl.value, inputLanguage.value);

  textInputEl.value = "";
});

formConversation.addEventListener("submit", (e) => {
  e.preventDefault();

  const textInputEl = formConversation.querySelector("input[type=text]") as HTMLInputElement;
  if (!textInputEl.value) return;

  sendData(
    {
      "content-type": "application/json",
    },
    JSON.stringify({
      params: { text: textInputEl.value },
      language: inputLanguage.value,
      session: inputSessionId.value,
    }),
  );

  textInputEl.value = "";
});

formEvent.addEventListener("submit", (e) => {
  e.preventDefault();

  const textInputEl = formEvent.querySelector("input[type=text]") as HTMLInputElement;
  if (!textInputEl.value) return;

  sendData(
    {
      "content-type": "application/json",
    },
    JSON.stringify({
      params: { event: { name: textInputEl.value } },
      language: inputLanguage.value,
      session: inputSessionId.value,
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

  sendData({}, fd);
});
