import { $, addMessage, cleanMessages } from "./utils";

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

interface MemoryResult {
  id: string;
  score: number;
  payload: {
    text: string;
  };
}

const $brainReload = $("#brain-reload") as HTMLButtonElement;

const $ioChannelGetInteractions = $("#io-channel-get-interactions") as HTMLButtonElement;

const $ioChannelsSelect = document.getElementById("io-channels") as HTMLSelectElement;
const $peopleSelect = document.getElementById("people") as HTMLSelectElement;

const $personApprove = $("#person-approve") as HTMLButtonElement;

const $inputMessage = $("#admin-input-message-text") as HTMLInputElement;
const $formInputMessage = $("#admin-input-message") as HTMLFormElement;

const $outputMessage = $("#admin-output-message-text") as HTMLInputElement;
const $formOutputMessage = $("#admin-output-message") as HTMLFormElement;

// Memory search elements
const $memoryType = $("#memory-type") as HTMLSelectElement;
const $memorySearch = $("#memory-search") as HTMLInputElement;
const $memorySearchBtn = $("#memory-search-btn") as HTMLButtonElement;
const $memorySearchText = $("#memory-search-text") as HTMLSpanElement;
const $memorySearchSpinner = $("#memory-search-spinner") as HTMLSpanElement;
const $memoryResults = $("#memory-results") as HTMLDivElement;
const $memorySearchForm = $("#memory-search-form") as HTMLFormElement;

export async function apiGetIOChannels(): Promise<IOChannel[]> {
  const response = await fetch(`/api/io_channels`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();

  return json.data ?? [];
}

export async function apiGetPeople(): Promise<Person[]> {
  const response = await fetch(`/api/persons`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();

  return json.data ?? [];
}

async function apiGetInteractions(ioChannelId: string): Promise<Interaction[]> {
  const response = await fetch(`/api/io_channels/${ioChannelId}/interactions`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();

  return json.data ?? [];
}

async function apiSearchMemories(type: string, text: string): Promise<MemoryResult[]> {
  const response = await fetch(`/api/memories/search?type=${type}&text=${encodeURIComponent(text)}`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();
  return json.data ?? [];
}

function setLoading(isLoading: boolean) {
  $memorySearchBtn.disabled = isLoading;
  $memorySearchText.textContent = isLoading ? "Searching..." : "Search";
  $memorySearchSpinner.classList.toggle("d-none", !isLoading);
}

function displayMemoryResults(results: MemoryResult[]) {
  $memoryResults.innerHTML = "";

  if (results.length === 0) {
    $memoryResults.innerHTML = '<div class="alert alert-info">No results found</div>';
    return;
  }

  const resultsList = document.createElement("div");
  resultsList.className = "list-group";

  results.forEach((result) => {
    const item = document.createElement("div");
    item.className = "list-group-item bg-dark text-light border-secondary";

    const score = document.createElement("small");
    score.className = "text-muted d-block mb-2";
    score.textContent = `Score: ${result.score.toFixed(2)}`;

    const text = document.createElement("div");
    text.className = "text-break";
    text.textContent = result.payload.text;

    item.appendChild(score);
    item.appendChild(text);
    resultsList.appendChild(item);
  });

  $memoryResults.appendChild(resultsList);
}

function bindEventsMemorySearch() {
  $memorySearchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = $memoryType.value;
    const text = $memorySearch.value.trim();

    if (!text) {
      addMessage("CONTROL CENTER", "Please enter search text", "system output error");
      return;
    }

    try {
      setLoading(true);
      const results = await apiSearchMemories(type, text);
      displayMemoryResults(results);
    } catch (error) {
      console.error("Error searching memories:", error);
      addMessage("CONTROL CENTER", "Error searching memories", "system output error");
    } finally {
      setLoading(false);
    }
  });
}

function bindEventsPersonApprove() {
  $personApprove.addEventListener("click", async () => {
    const personId = $peopleSelect.value;
    const response = await fetch(`/api/persons/${personId}/approve`, {
      method: "POST",
      headers: {
        "x-auth-person": localStorage.getItem("auth"),
      },
    });

    const json = await response.json();

    addMessage("CONTROL CENTER", JSON.stringify(json), `system output ${json.error ? "error" : ""}`);
  });
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
    $brainReload.setAttribute("disabled", "disabled");

    const types = [];
    if (($("#brain-reload-prompt") as HTMLInputElement).checked) {
      types.push("prompt");
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

    addMessage("CONTROL CENTER", JSON.stringify(json), `system output ${json.error ? "error" : ""}`);

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
  $formInputMessage.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    addMessage("CONTROL CENTER", JSON.stringify(json), `system output ${json.error ? "error" : ""}`);

    $inputMessage.value = "";
  });
}

function bindEventsOutputMessage() {
  $formOutputMessage.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    addMessage("CONTROL CENTER", JSON.stringify(json), `system output ${json.error ? "error" : ""}`);

    $outputMessage.value = "";
  });
}

export function bindEvents() {
  bindEventsSelects();
  bindEventsBrainReload();
  bindEventsInputMessage();
  bindEventsOutputMessage();
  bindEventsIOChannelGetInteractions();
  bindEventsPersonApprove();
  bindEventsMemorySearch();
}
