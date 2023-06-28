import Recorder from "recorder-js";

declare let webkitAudioContext: any; // ADDED

const formConversation = document.querySelector("#conversation") as HTMLFormElement;
const formRepeat = document.querySelector("#repeat") as HTMLFormElement;

const inputIOChannel = document.querySelector("#io_channel") as HTMLInputElement;
const inputPerson = document.querySelector("#person") as HTMLInputElement;

const audio = document.querySelector("audio") as HTMLAudioElement;
const responseTextarea = document.getElementById("response") as HTMLTextAreaElement;
const recordStartBtn = document.getElementById("record-start");
const recordStopBtn = document.getElementById("record-stop");

async function textToSpeech(text: string) {
  audio.src = "";
  audio.volume = 0;
  audio.play();

  const url = new URL("/api/speech", location.href);
  url.search = new URLSearchParams({ text, language: navigator.language }).toString();

  responseTextarea.value = text;

  audio.src = url.toString();

  audio.volume = 1;
  audio.play();
}

async function sendData(body) {
  audio.src = "";
  audio.volume = 0;
  audio.play();

  const response = await fetch("/io/web", {
    method: "POST",
    headers: {
      "content-type": "application/json",
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

  textToSpeech(textInputEl.value);

  textInputEl.value = "";
});

formConversation.addEventListener("submit", (e) => {
  e.preventDefault();

  const textInputEl = formConversation.querySelector("input[type=text]") as HTMLInputElement;
  if (!textInputEl.value) return;

  sendData(
    JSON.stringify({
      params: { text: textInputEl.value },
      io_channel: inputIOChannel.value,
      person: inputPerson.value,
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
