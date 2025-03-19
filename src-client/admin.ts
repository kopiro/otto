import { $, $$, addMessage, cleanMessages } from "./utils";

interface IOChannel {
  id: string;
  name: string;
  driverName: string;
}

interface Person {
  id: string;
  name: string;
}

interface Interaction {
  id: string;
  input: {
    text?: string;
  };
  output: {
    text?: string;
  };
  source: "input" | "output";
  createdAt: string;
  person: Person;
  sourceName: string;
}

const $brainReload = $("#brain-reload") as HTMLButtonElement;

const $ioChannelGetInteractions = $("#io-channel-get-interactions") as HTMLButtonElement;

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

async function apiGetInteractions(ioChannelId: string): Promise<Interaction[]> {
  const response = await fetch(`/api/io_channels/${ioChannelId}/interactions`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();
  if (json.error) {
    addMessage("CONTROL CENTER", json.error.message, "system output error");
    return [];
  }

  return json.data;
}

function bindEventsIOChannelGetInteractions() {
  $ioChannelGetInteractions.addEventListener("click", async () => {
    cleanMessages();

    const ioChannelId = $ioChannelsSelect.value;
    const interactions = await apiGetInteractions(ioChannelId);

    interactions.forEach((interaction) => {
      if (interaction.input) {
        addMessage(
          interaction.sourceName,
          interaction.input.text ? interaction.input.text : JSON.stringify(interaction.input),
          "input",
          interaction.createdAt,
        );
      }
      if (interaction.output) {
        addMessage(
          interaction.sourceName,
          interaction.output.text ? interaction.output.text : JSON.stringify(interaction.output),
          "output",
          interaction.createdAt,
        );
      }
    });
  });
}

function bindEventsBrainReload() {
  $brainReload.addEventListener("click", async () => {
    if (!localStorage.getItem("auth")) {
      addMessage("CONTROL CENTER", "No auth", "system output error");
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
      addMessage("CONTROL CENTER", json.error.message, "system output error");
    } else {
      addMessage("CONTROL CENTER", "Brain reloaded", "system output");
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
        option.textContent = channel.name;
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
      addMessage("CONTROL CENTER", json.error.message, "system output error");
    } else {
      addMessage("CONTROL CENTER", "Input message sent", "system outout");
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
      addMessage("CONTROL CENTER", json.error.message, "system output error");
    } else {
      addMessage("CONTROL CENTER", "Output message sent", "system output");
    }

    $outputMessage.value = "";
  });
}

export function bindEvents() {
  bindEventsSelects();
  bindEventsBrainReload();
  bindEventsInputMessage();
  bindEventsOutputMessage();
  bindEventsIOChannelGetInteractions();
}
