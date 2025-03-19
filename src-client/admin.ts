import { $, $$, addMessage } from "./utils";

interface IOChannel {
  id: string;
  name: string;
  driverName: string;
}

interface Person {
  id: string;
  name: string;
}

const $brainReload = $("#brain-reload") as HTMLButtonElement;

const $ioChannelsSelect = document.getElementById("io-channels") as HTMLSelectElement;
const $peopleSelect = document.getElementById("people") as HTMLSelectElement;

const $inputMessage = $("#admin-input-message") as HTMLInputElement;
const $sendInputMessage = $("#send-input-message") as HTMLButtonElement;

const $outputMessage = $("#admin-output-message") as HTMLInputElement;
const $sendOutputMessage = $("#send-output-message") as HTMLButtonElement;

export async function apiGetIOChannels(): Promise<IOChannel[]> {
  const response = await fetch(`/api/io_channels`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return json.data;
}

export async function apiGetPeople(): Promise<Person[]> {
  const response = await fetch(`/api/persons`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return json.data;
}

function bindEventsBrainReload() {
  $brainReload.addEventListener("click", async () => {
    if (!localStorage.getItem("auth")) {
      addMessage("No auth", "system error");
      return;
    }

    $brainReload.setAttribute("disabled", "disabled");

    const types = [];
    if (($("#brain-reload-episodic") as HTMLInputElement).checked) {
      types.push("episodic");
    }
    if (($("#brain-reload-social") as HTMLInputElement).checked) {
      types.push("prompt");
    }
    if (($("#brain-reload-declarative") as HTMLInputElement).checked) {
      types.push("declarative");
    }

    const resp = await fetch("/api/admin/brain_reload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-person": localStorage.getItem("auth"),
      },
      body: JSON.stringify({
        types,
      }),
    });
    const json = await resp.json();

    if (json.error) {
      addMessage(json.error.message, "system error");
    } else {
      addMessage("Brain reloaded", "system");
    }

    $brainReload.removeAttribute("disabled");
  });
}

function bindEventsSelects() {
  if (!localStorage.getItem("auth")) {
    $ioChannelsSelect.innerHTML = '<option value="">No auth</option>';
    $peopleSelect.innerHTML = '<option value="">No auth</option>';
    return;
  }

  // Empty selects
  $ioChannelsSelect.innerHTML = "";
  $peopleSelect.innerHTML = "";

  // Fetch and populate IO Channels
  apiGetIOChannels()
    .then((channels) => {
      channels.forEach((channel) => {
        const option = document.createElement("option");
        option.value = channel.id;
        option.textContent = `${channel.name} (${channel.driverName})`;
        $ioChannelsSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error fetching IO channels:", error);
      $ioChannelsSelect.innerHTML = '<option value="">Error loading IO channels</option>';
    });

  // Fetch and populate People
  apiGetPeople()
    .then((people) => {
      people.forEach((person) => {
        const option = document.createElement("option");
        option.value = person.id;
        option.textContent = person.name;
        $peopleSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error fetching people:", error);
      $peopleSelect.innerHTML = '<option value="">Error loading people</option>';
    });
}

function bindEventsInputMessage() {
  $sendInputMessage.addEventListener("click", async () => {
    const ioChannelId = $ioChannelsSelect.value;
    const personId = $peopleSelect.value;

    const response = await fetch("/api/input", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-person": localStorage.getItem("auth"),
      },
      body: JSON.stringify({
        io_channel: ioChannelId,
        person: personId,
        input: {
          role: "system",
          text: $inputMessage.value,
        },
      }),
    });

    const json = await response.json();

    if (json.error) {
      addMessage(json.error.message, "system error");
    } else {
      addMessage("Input message sent", "system");
    }

    $inputMessage.value = "";
  });
}

function bindEventsOutputMessage() {
  $sendOutputMessage.addEventListener("click", async () => {
    const ioChannelId = $ioChannelsSelect.value;
    const personId = $peopleSelect.value;

    const response = await fetch("/api/output", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-person": localStorage.getItem("auth"),
      },
      body: JSON.stringify({
        io_channel: ioChannelId,
        person: personId,
        output: {
          text: $outputMessage.value,
        },
      }),
    });

    const json = await response.json();

    if (json.error) {
      addMessage(json.error.message, "system error");
    } else {
      addMessage("Output message sent", "system");
    }

    $outputMessage.value = "";
  });
}

export function bindEvents() {
  bindEventsSelects();
  bindEventsBrainReload();
  bindEventsInputMessage();
  bindEventsOutputMessage();
}
