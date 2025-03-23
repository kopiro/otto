import { $, addMessage } from "./utils";

interface IOChannel {
  id: string;
  name: string;
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
    error?: any;
  };
  createdAt: string;
  sourceName: string;
}

interface GroupedInteractions {
  channel: IOChannel;
  interactions: Interaction[];
}

interface InteractionsResponse {
  data: Record<string, GroupedInteractions>;
}

interface MemoryResult {
  id: string;
  score: number;
  payload: {
    text: string;
  };
}

const $inputAuth = $("#input-auth") as HTMLInputElement;

const $brainReload = $("#brain-reload") as HTMLButtonElement;

const $ioChannelsSelect = $("#io-channels") as HTMLSelectElement;
const $peopleSelect = $("#people") as HTMLSelectElement;

const $personApprove = $("#person-approve") as HTMLButtonElement;

const $formInputMessage = $("#admin-input-message") as HTMLFormElement;
const $formOutputMessage = $("#admin-output-message") as HTMLFormElement;

const $messages = $("#messages") as HTMLDivElement;

// Memory search elements
const $memoryType = $("#memory-type") as HTMLSelectElement;
const $memorySearch = $("#memory-search") as HTMLInputElement;
const $memorySearchBtn = $("#memory-search-btn") as HTMLButtonElement;
const $memorySearchText = $("#memory-search-text") as HTMLSpanElement;
const $memorySearchSpinner = $("#memory-search-spinner") as HTMLSpanElement;
const $memoryResults = $("#memory-results") as HTMLDivElement;
const $memorySearchForm = $("#memory-search-form") as HTMLFormElement;

// DOM Elements
const $interactionsSearchBtn = $("#interactions-search-btn") as HTMLButtonElement;
const $interactionsSearchText = $("#interactions-search-text") as HTMLSpanElement;
const $interactionsSearchSpinner = $("#interactions-search-spinner") as HTMLSpanElement;

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

async function apiGetInteractions(ioChannel?: string, date?: string): Promise<InteractionsResponse> {
  const params = new URLSearchParams();
  if (ioChannel) params.append("ioChannel", ioChannel);
  if (date) params.append("date", date);

  const response = await fetch(`/api/interactions?${params.toString()}`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch interactions");
  }

  return response.json();
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

async function apiDeleteMemory(id: string, type: string): Promise<void> {
  const response = await fetch(`/api/memories/${id}?type=${type}`, {
    method: "DELETE",
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  if (!response.ok) {
    const json = await response.json();
    throw new Error(json.error?.message || "Failed to delete memory");
  }
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
    item.className =
      "list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center";

    const content = document.createElement("div");
    content.className = "flex-grow-1";

    const score = document.createElement("small");
    score.className = "text-muted d-block mb-2";
    score.textContent = `Score: ${result.score.toFixed(2)}`;

    const text = document.createElement("div");
    text.className = "text-break";
    text.textContent = result.payload.text;

    content.appendChild(score);
    content.appendChild(text);
    item.appendChild(content);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger btn-sm ms-2";
    deleteBtn.innerHTML = `
      <span class="delete-text">Delete</span>
      <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
    `;
    deleteBtn.onclick = async () => {
      const deleteText = deleteBtn.querySelector(".delete-text") as HTMLSpanElement;
      const spinner = deleteBtn.querySelector(".spinner-border") as HTMLSpanElement;

      try {
        // Set loading state
        deleteBtn.disabled = true;
        deleteText.textContent = "Deleting...";
        spinner.classList.remove("d-none");

        await apiDeleteMemory(result.id, $memoryType.value);
        // Refresh the search results
        const text = $memorySearch.value.trim();
        if (text) {
          const results = await apiSearchMemories($memoryType.value, text);
          displayMemoryResults(results);
        }
      } catch (error) {
        console.error("Error deleting memory:", error);
        const errorDiv = document.createElement("div");
        errorDiv.className = "alert alert-danger mt-2";
        errorDiv.textContent = `Error deleting memory: ${(error as Error).message}`;
        item.appendChild(errorDiv);
      } finally {
        // Reset loading state
        deleteBtn.disabled = false;
        deleteText.textContent = "Delete";
        spinner.classList.add("d-none");
      }
    };

    item.appendChild(deleteBtn);
    resultsList.appendChild(item);
  });

  $memoryResults.appendChild(resultsList);
}

function setLoadingMemory(isLoading: boolean) {
  $memorySearchBtn.disabled = isLoading;
  $memorySearchText.textContent = isLoading ? "Searching..." : "Search";
  $memorySearchSpinner.classList.toggle("d-none", !isLoading);
}

function bindEventsMemorySearch() {
  $memorySearchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = $memoryType.value;
    const text = $memorySearch.value.trim();

    if (!text) {
      addApiStatus($memorySearchForm, "Please enter search text", "error");
      return;
    }

    try {
      setLoadingMemory(true);
      clearApiStatus($memorySearchForm);
      const results = await apiSearchMemories(type, text);
      displayMemoryResults(results);
    } catch (error) {
      addApiStatus($memorySearchForm, `Error searching memories: ${(error as Error).message}`, "error");
    } finally {
      setLoadingMemory(false);
    }
  });
}

function addApiStatus(element: HTMLElement, message: string, type: "success" | "error" | "info" = "info") {
  const statusDiv = element.querySelector(".api-status");
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div class="alert alert-${type === "error" ? "danger" : type} mt-2 mb-0">
        ${message}
      </div>
    `;
  } else {
    console.error("No status div found", element);
  }
}

function clearApiStatus(element: HTMLElement) {
  const statusDiv = element.querySelector(".api-status");
  if (statusDiv) {
    statusDiv.innerHTML = "";
  }
}

function bindEventsPersonApprove() {
  $personApprove.addEventListener("click", async () => {
    const personId = $peopleSelect.value;
    const $apiStatusContainer = $personApprove.closest(".card-body") as HTMLDivElement;

    if (!personId) {
      addApiStatus($apiStatusContainer, "Please select a person to approve", "error");
      return;
    }

    try {
      // Set loading state
      $personApprove.disabled = true;
      $personApprove.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span>Approving...</span>
      `;
      clearApiStatus($apiStatusContainer);

      const response = await fetch(`/api/persons/${personId}/approve`, {
        method: "POST",
        headers: {
          "x-auth-person": localStorage.getItem("auth"),
        },
      });

      const json = await response.json();

      if (json.error) {
        addApiStatus($apiStatusContainer, json.error.message || "Failed to approve person", "error");
      } else {
        addApiStatus($apiStatusContainer, `Person ${personId} approved successfully`, "success");
      }
    } catch (error) {
      addApiStatus($apiStatusContainer, `Error: ${(error as Error).message}`, "error");
    } finally {
      // Reset button state
      $personApprove.disabled = false;
      $personApprove.innerHTML = "Approve";
    }
  });
}

function bindEventsBrainReload() {
  $brainReload.addEventListener("click", async () => {
    const $apiStatusContainer = $brainReload.closest(".card-body") as HTMLDivElement;

    try {
      $brainReload.disabled = true;
      $brainReload.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
      clearApiStatus($apiStatusContainer);

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

      if (json.error) {
        addApiStatus($apiStatusContainer, json.error.message || "An error occurred", "error");
      } else {
        addApiStatus($apiStatusContainer, "Brain reloaded successfully", "success");
      }
    } catch (error) {
      addApiStatus($apiStatusContainer, (error as Error).message, "error");
    } finally {
      $brainReload.disabled = false;
      $brainReload.innerHTML = "Brain reload";
    }
  });
}

function bindEventsSelects() {
  if (!localStorage.getItem("auth")) {
    $ioChannelsSelect.innerHTML = '<option value="">No auth</option>';
    $peopleSelect.innerHTML = '<option value="">No auth</option>';
    return;
  }

  // Empty selects
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

    const $inputMessage = $formInputMessage.querySelector('input[type="text"]') as HTMLInputElement;
    const $submitBtn = $formInputMessage.querySelector('button[type="submit"]') as HTMLButtonElement;

    try {
      $submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
      $submitBtn.disabled = true;
      $inputMessage.disabled = true;

      clearApiStatus($formInputMessage);

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
        addApiStatus($formInputMessage, json.error.message, "error");
      } else {
        addApiStatus($formInputMessage, JSON.stringify(json, null, 2), "success");
      }
    } catch (err) {
      addApiStatus($formInputMessage, (err as Error).message, "error");
    } finally {
      $submitBtn.innerHTML = "Send";
      $submitBtn.disabled = false;
      $inputMessage.disabled = false;
      $inputMessage.value = "";
    }
  });
}

function bindEventsOutputMessage() {
  $formOutputMessage.addEventListener("submit", async (e) => {
    e.preventDefault();

    const ioChannelId = $ioChannelsSelect.value;
    const personId = $peopleSelect.value;

    const $outputMessage = $formOutputMessage.querySelector('input[type="text"]') as HTMLInputElement;
    const $submitBtn = $formOutputMessage.querySelector('button[type="submit"]') as HTMLButtonElement;

    try {
      $submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
      $submitBtn.disabled = true;
      $outputMessage.disabled = true;

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
        addApiStatus($formOutputMessage, json.error.message, "error");
      } else {
        addApiStatus($formOutputMessage, JSON.stringify(json, null, 2), "success");
      }
    } catch (err) {
      addApiStatus($formOutputMessage, (err as Error).message, "error");
    } finally {
      $submitBtn.innerHTML = "Send";
      $submitBtn.disabled = false;
      $outputMessage.value = "";
      $outputMessage.disabled = false;
    }
  });
}

function displayInteractions(interactions: Record<string, GroupedInteractions>) {
  // Clear previous messages
  $messages.innerHTML = "";

  if (Object.keys(interactions).length === 0) {
    return;
  }

  Object.entries(interactions).forEach(([channelId, channelData]) => {
    // Create section for this channel
    const $sectionIOChannel = document.createElement("div");
    $sectionIOChannel.className = "messages-section";

    // Add channel header
    const $header = document.createElement("div");
    $header.className = "text-light border-bottom pb-2";
    $header.textContent = channelData.channel.name;
    $sectionIOChannel.appendChild($header);

    // Add all interactions for this channel
    channelData.interactions.forEach((interaction) => {
      if (interaction.input) {
        addMessage(
          interaction.sourceName,
          interaction.input?.text ?? JSON.stringify(interaction.input),
          `input ${interaction.sourceName.toUpperCase() === "SYSTEM" ? "system" : ""}`,
          interaction.createdAt,
          $sectionIOChannel,
        );
      }
      if (interaction.output) {
        addMessage(
          interaction.sourceName,
          interaction.output.text ?? JSON.stringify(interaction.output),
          "output",
          interaction.createdAt,
          $sectionIOChannel,
        );
      }
    });

    // Add the section to messages
    $messages.appendChild($sectionIOChannel);
  });
}

function setInteractionsLoading(isLoading: boolean) {
  $interactionsSearchBtn.disabled = isLoading;
  $interactionsSearchText.textContent = isLoading ? "Searching..." : "Search";
  $interactionsSearchSpinner.classList.toggle("d-none", !isLoading);
}

async function populateIOChannels() {
  try {
    const channels = await apiGetIOChannels();
    const $ioChannelsSelect = $("#interactions-io-channel") as HTMLSelectElement;
    $ioChannelsSelect.innerHTML = '<option value="">All Channels</option>';
    channels.forEach((channel) => {
      const option = document.createElement("option");
      option.value = channel.id;
      option.textContent = channel.name;
      $ioChannelsSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Failed to populate IO channels:", error);
  }
}

async function bindEventsInteractions() {
  const $interactionsForm = $("#interactions-filter-form") as HTMLFormElement;
  const $interactionsDate = $("#interactions-date") as HTMLInputElement;

  // Set today's date as default
  const today = new Date().toISOString().split("T")[0];
  $interactionsDate.value = today;

  // Populate IO channels dropdown
  await populateIOChannels();

  $interactionsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearApiStatus($interactionsForm);

    const ioChannelId =
      ($interactionsForm.querySelector("#interactions-io-channel") as HTMLSelectElement).value || undefined;
    const date = ($interactionsForm.querySelector("#interactions-date") as HTMLInputElement).value || undefined;

    let interactions = {};

    try {
      setInteractionsLoading(true);
      const response = await apiGetInteractions(ioChannelId, date);
      interactions = response.data;
    } catch (error) {
      addApiStatus($interactionsForm, error.message, "error");
    } finally {
      setInteractionsLoading(false);
    }

    displayInteractions(interactions);
  });
}

export function bindEvents() {
  $inputAuth.value = localStorage.getItem("auth") || "";
  $inputAuth.addEventListener("change", () => {
    localStorage.setItem("auth", $inputAuth.value);
  });

  bindEventsSelects();
  bindEventsBrainReload();
  bindEventsInputMessage();
  bindEventsOutputMessage();
  bindEventsPersonApprove();
  bindEventsMemorySearch();
  bindEventsInteractions();
}

bindEvents();
