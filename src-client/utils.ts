import { API_Interaction, API_Person, EmotionContext } from "../src/types";

export const $ = (selector: string) => document.querySelector(selector);
export const $$ = (selector: string) => document.querySelectorAll(selector);

const $messages = $("#messages") as HTMLDivElement;
const $aiAudio = $("#ai-audio") as HTMLAudioElement;
const $userAudio = $("#user-audio") as HTMLAudioElement;
const $inputPerson = $("#person") as HTMLInputElement;

// Add emotion emojis mapping
const EMOTION_EMOJIS: Record<keyof EmotionContext, string> = {
  love: "❤️",
  trust: "🤝",
  respect: "🙏",
  anger: "😠",
  jealousy: "😒",
};

export function cleanMessages() {
  $messages.innerHTML = "";
}

export function addMessage(
  author: string,
  text: string,
  className: string,
  createdAt: string = new Date().toISOString(),
  interaction: API_Interaction = null,
  $container = $messages,
) {
  const $message = document.createElement("div");
  $message.className = `message ${className}`;

  const $header = document.createElement("div");
  $header.className = "message-header";
  $header.innerHTML = `
    <span class="message-name">${author}</span>
    <span class="message-time">${new Date(createdAt).toLocaleString("en-GB")}</span>
  `;
  $message.appendChild($header);

  const $content = document.createElement("div");
  $content.className = "message-content";
  $content.textContent = text;
  $message.appendChild($content);

  // Add collapsible JSON view
  let $jsonContainer: HTMLDivElement | null = null;
  if (interaction) {
    $jsonContainer = document.createElement("div");
    $jsonContainer.className = "message-json d-none";
    const $jsonCode = document.createElement("code");
    $jsonCode.className = "text-break";
    $jsonCode.textContent = JSON.stringify(interaction, null, 2);
    $jsonContainer.appendChild($jsonCode);
    $message.appendChild($jsonContainer);
  }

  // Add toggle button
  const $toggleBtn = document.createElement("button");
  $toggleBtn.className = "btn btn-link btn-sm p-0 message-toggle";
  $toggleBtn.innerHTML = '<i class="bi bi-chevron-down"></i>';
  $toggleBtn.onclick = () => {
    if ($jsonContainer) {
      $jsonContainer.classList.toggle("d-none");
      $toggleBtn.innerHTML = $jsonContainer.classList.contains("d-none")
        ? '<i class="bi bi-chevron-down"></i>'
        : '<i class="bi bi-chevron-up"></i>';
    }
  };
  $message.appendChild($toggleBtn);

  // Add emotion changes if it's an output message
  if (interaction?.output?.emotionsUpdates) {
    const $emotionChanges = document.createElement("div");
    $emotionChanges.className = "emotion-changes";

    // Calculate and display changes
    Object.entries(interaction.output.emotionsUpdates).forEach(([emotion, value]) => {
      const emoji = EMOTION_EMOJIS[emotion as keyof EmotionContext];
      const $change = document.createElement("span");
      $change.className = "emotion-change";
      $change.innerHTML = `${emoji} ${value > 0 ? "+" : ""}${value}`;
      $emotionChanges.appendChild($change);
    });

    if ($emotionChanges.children.length > 0) {
      $message.appendChild($emotionChanges);
    }
  }

  $container.appendChild($message);

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
