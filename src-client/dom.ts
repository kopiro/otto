import Recorder from "recorder-js";
import { addMessage, aiTextToSpeech, apiIOWeb, userTextToSpeech, $ } from "./utils";

const $formConversation = $("#conversation") as HTMLFormElement;
const $formRepeat = $("#repeat") as HTMLFormElement;

const $inputAuth = $("#auth") as HTMLInputElement;
const $inputPerson = $("#person") as HTMLInputElement;
const $inputTextToSpeechOutput = $("#text-to-speech") as HTMLInputElement;

const $inputUserTextToSpeech = $("#user-text-to-speech") as HTMLInputElement;
const $inputGender = $("#user-gender") as HTMLInputElement;

const $aiAudio = $("#ai-audio") as HTMLAudioElement;

const $recordStartBtn = $("#record-start");
const $recordStopBtn = $("#record-stop");

export function bindEvents() {
  $formRepeat.addEventListener("submit", (e) => {
    e.preventDefault();

    const textInputEl = $formRepeat.querySelector("input[type=text]") as HTMLInputElement;
    if (!textInputEl.value) return;

    aiTextToSpeech(textInputEl.value);

    textInputEl.value = "";
  });

  $formConversation.addEventListener("submit", (e) => {
    e.preventDefault();

    $aiAudio.src = "";
    $aiAudio.volume = 0;
    $aiAudio.play();

    const textInputEl = $formConversation.querySelector("input[type=text]") as HTMLInputElement;
    if (!textInputEl.value) return;

    addMessage("Human", textInputEl.value, "input");

    if ($inputUserTextToSpeech.checked) {
      userTextToSpeech(textInputEl.value, $inputGender.value);
    }

    apiIOWeb(
      JSON.stringify({
        params: { text: textInputEl.value },
        person: $inputPerson.value,
        text_to_speech: $inputTextToSpeechOutput.checked,
      }),
    );

    textInputEl.value = "";
  });

  let recorder;

  $recordStartBtn.addEventListener("click", async () => {
    recorder = new Recorder(new (window.AudioContext || window.webkitAudioContext)());

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await recorder.init(stream);
    await recorder.start();

    $recordStopBtn.removeAttribute("disabled");
    $recordStartBtn.setAttribute("disabled", "disabled");
  });

  $recordStopBtn.addEventListener("click", async () => {
    const { blob } = await recorder.stop();
    $recordStartBtn.removeAttribute("disabled");
    $recordStopBtn.setAttribute("disabled", "disabled");

    const fd = new FormData();
    fd.append("audio", blob);

    apiIOWeb(fd);
  });

  $inputAuth.value = localStorage.getItem("auth") || "";
  $inputAuth.addEventListener("change", () => {
    localStorage.setItem("auth", $inputAuth.value);
  });

  $inputPerson.value = localStorage.getItem("person") || "";
  $inputPerson.addEventListener("change", () => {
    localStorage.setItem("person", $inputPerson.value);
  });
}
