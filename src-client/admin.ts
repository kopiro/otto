import { $, addMessage } from "./utils";
import * as d3 from "d3";
import type {
  EmotionContext,
  API_IOChannel,
  API_Person,
  API_Memory,
  API_EpisodicMemoryTodo,
  API_GroupedInteractionsByChannelID,
  API_InputToCloseFriend,
} from "../src/types";

interface DetailField {
  label: string;
  value: string | number | boolean | object;
  editable?: boolean;
  wrapper?: string;
}

const $inputAuth = $("#input-auth") as HTMLInputElement;

const $brainReloadPrompt = $("#brain-reload-prompt") as HTMLButtonElement;
const $brainReloadDeclarative = $("#brain-reload-declarative") as HTMLButtonElement;
const $brainReloadSocial = $("#brain-reload-social") as HTMLButtonElement;
const $processQueue = $("#process-queue") as HTMLButtonElement;

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

const $memoryResults = $("#memory-results") as HTMLDivElement;
const $memorySearchForm = $("#memory-search-form") as HTMLFormElement;

// DOM Elements
const $interactionsSearchBtn = $("#interactions-search-btn") as HTMLButtonElement;

const $personDetailsContainer = $("#person-details-container") as HTMLDivElement;

const $ioChannelDetailsContainer = $("#io-channel-details-container") as HTMLDivElement;

// Add these constants at the top with other DOM elements
const $schedulerMapTable = document.getElementById("scheduler-map-table") as HTMLTableSectionElement;
const $episodicTodoTable = document.getElementById("episodic-todo-table") as HTMLTableSectionElement;
const $episodicTodoRefresh = $("#episodic-todo-refresh") as HTMLButtonElement;

interface CardOptions {
  title?: string;
  content: HTMLElement;
  className?: string;
}

function createCard({ title, content, className = "" }: CardOptions): HTMLDivElement {
  const $card = document.createElement("div");
  $card.className = `card bg-dark border-secondary ${className}`;

  if (title) {
    const $header = document.createElement("div");
    $header.className = "card-header bg-dark border-secondary";
    const $title = document.createElement("h5");
    $title.className = "card-title mb-0 text-light";
    $title.textContent = title;
    $header.appendChild($title);
    $card.appendChild($header);
  }

  const $body = document.createElement("div");
  $body.className = "card-body";
  $body.appendChild(content);
  $card.appendChild($body);

  return $card;
}

function createDetailList(details: DetailField[]): HTMLElement {
  const $list = document.createElement("dl");
  $list.className = "row mb-0";

  details.forEach(({ label, value, editable, wrapper }) => {
    const $dt = document.createElement("dt");
    $dt.className = "col-sm-3 text-muted";
    $dt.textContent = label;

    const $dd = document.createElement("dd");
    $dd.className = "col-sm-9";

    if (editable) {
      const $input = document.createElement("input");
      $input.type = "text";
      $input.className = "form-control bg-dark text-light border-secondary";
      $input.value = value.toString();
      $input.name = label.toLowerCase();
      $input.setAttribute("required", "");
      $dd.appendChild($input);
    } else {
      $dd.className = "col-sm-9 text-light";
      if (wrapper === "code") {
        const $code = document.createElement("code");
        $code.className = "text-break";
        $code.textContent = value.toString();
        $dd.appendChild($code);
      } else {
        $dd.textContent = value.toString();
      }
    }

    $list.appendChild($dt);
    $list.appendChild($dd);
  });

  return $list;
}

function createEditButton(): HTMLButtonElement {
  const $buttonContainer = document.createElement("div");
  $buttonContainer.className = "mt-3 d-flex justify-content-end";

  const $editButton = document.createElement("button");
  $editButton.type = "submit";
  $editButton.className = "btn btn-primary";
  $editButton.innerHTML = `
    <span class="edit-text">Save edits</span>
    <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
  `;

  $buttonContainer.appendChild($editButton);
  return $editButton;
}

function createDetailsCard(details: DetailField[], onSubmit: (formData: FormData) => Promise<void>): HTMLDivElement {
  const $card = createCard({
    content: document.createElement("div"),
    className: "mt-3",
  });

  const $body = $card.querySelector(".card-body") as HTMLDivElement;

  // Add API status container
  const $apiStatus = document.createElement("div");
  $apiStatus.className = "api-status mb-3";
  $body.appendChild($apiStatus);

  // Create form
  const $form = document.createElement("form");
  $form.className = "needs-validation";
  $form.setAttribute("novalidate", "");

  // Add details list
  const $list = createDetailList(details);
  $form.appendChild($list);

  // Create and display the radar chart

  // Add edit button
  const $editButton = createEditButton();
  $form.appendChild($editButton);

  // Add form submit handler
  $form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const $apiStatusContainer = $card.querySelector(".card-body") as HTMLDivElement;

    try {
      $editButton.disabled = true;
      $editButton.querySelector(".edit-text")!.textContent = "Saving...";
      $editButton.querySelector(".spinner-border")!.classList.remove("d-none");
      clearApiStatus($apiStatusContainer);

      const formData = new FormData($form);
      await onSubmit(formData);
    } catch (error) {
      addApiStatus($apiStatusContainer, `Error: ${(error as Error).message}`, "error");
    } finally {
      $editButton.disabled = false;
      $editButton.querySelector(".edit-text")!.textContent = "Save edits";
      $editButton.querySelector(".spinner-border")!.classList.add("d-none");
    }
  });

  $body.appendChild($form);
  return $card;
}

export async function apiGetIOChannels(): Promise<API_IOChannel[]> {
  const response = await fetch(`/api/io_channels`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();

  return json.data ?? [];
}

export async function apiGetPeople(): Promise<API_Person[]> {
  const response = await fetch(`/api/persons`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();

  return json.data ?? [];
}

async function apiGetInteractions(ioChannel?: string, date?: string): Promise<API_GroupedInteractionsByChannelID> {
  const params = new URLSearchParams();
  if (ioChannel) params.append("io_channel", ioChannel);
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

async function apiSearchMemories(type: string, text: string): Promise<API_Memory[]> {
  const response = await fetch(`/api/memories/search?type=${type}&text=${encodeURIComponent(text)}`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  const json = await response.json();
  return json.data ?? [];
}

async function apiDeleteMemory(id: string | number, type: string): Promise<void> {
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

function displayMemoryResults(results: API_Memory[]) {
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
  const $button = $memorySearchBtn;
  setButtonLoading($button, isLoading, "Searching...", "Search");
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

function setButtonLoading($button: HTMLButtonElement, isLoading: boolean, loadingText: string, defaultText: string) {
  $button.disabled = isLoading;
  const $text = $button.querySelector(".button-text") as HTMLSpanElement;
  const $spinner = $button.querySelector(".spinner-border") as HTMLSpanElement;

  $text.textContent = isLoading ? loadingText : defaultText;
  $spinner.classList.toggle("d-none", !isLoading);
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
      setButtonLoading($personApprove, true, "Approving...", "Approve");
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
      setButtonLoading($personApprove, false, "Approving...", "Approve");
    }
  });
}

function bindEventsBrainReload() {
  const handleBrainReload = async (button: HTMLButtonElement, type: string) => {
    const $apiStatusContainer = button.closest(".card-body") as HTMLDivElement;

    try {
      setButtonLoading(button, true, "Loading...", `Reload ${type}`);
      clearApiStatus($apiStatusContainer);

      const resp = await fetch(`/api/admin/memory_reload`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-auth-person": localStorage.getItem("auth"),
        },
        body: JSON.stringify({
          types: [type],
        }),
      });
      const json = await resp.json();

      if (json.error) {
        addApiStatus($apiStatusContainer, json.error.message || "An error occurred", "error");
      } else {
        addApiStatus($apiStatusContainer, `${type} reloaded successfully`, "success");
      }
    } catch (error) {
      addApiStatus($apiStatusContainer, (error as Error).message, "error");
    } finally {
      setButtonLoading(button, false, "Loading...", `Reload ${type}`);
    }
  };

  $brainReloadPrompt.addEventListener("click", () => handleBrainReload($brainReloadPrompt, "prompt"));
  $brainReloadDeclarative.addEventListener("click", () => handleBrainReload($brainReloadDeclarative, "declarative"));
  $brainReloadSocial.addEventListener("click", () => handleBrainReload($brainReloadSocial, "social"));
}

function bindEventsProcessQueue() {
  $processQueue.addEventListener("click", async () => {
    const $apiStatusContainer = $processQueue.closest(".card-body") as HTMLDivElement;

    try {
      setButtonLoading($processQueue, true, "Processing...", "Process Queue");
      clearApiStatus($apiStatusContainer);

      const response = await fetch("/api/admin/queue_process", {
        method: "POST",
        headers: {
          "x-auth-person": localStorage.getItem("auth"),
        },
      });

      const json = await response.json();

      if (json.error) {
        addApiStatus($apiStatusContainer, json.error.message || "An error occurred", "error");
      } else {
        if (json.result) {
          addApiStatus($apiStatusContainer, "Queue processed successfully", "success");
        } else {
          addApiStatus($apiStatusContainer, "Queue is empty", "info");
        }
      }
    } catch (error) {
      addApiStatus($apiStatusContainer, (error as Error).message, "error");
    } finally {
      setButtonLoading($processQueue, false, "Processing...", "Process Queue");
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
  $ioChannelsSelect.innerHTML = '<option value="">Select a channel</option>';
  $peopleSelect.innerHTML = '<option value="">Select a person</option>';

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
      setButtonLoading($submitBtn, true, "Sending...", "Send");
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
      setButtonLoading($submitBtn, false, "Sending...", "Send");
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
      setButtonLoading($submitBtn, true, "Sending...", "Send");
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
      setButtonLoading($submitBtn, false, "Sending...", "Send");
      $outputMessage.value = "";
      $outputMessage.disabled = false;
    }
  });
}

function displayInteractions(interactions: API_GroupedInteractionsByChannelID) {
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
        if (interaction.input?.text) {
          addMessage(
            interaction.sourceName,
            interaction.input.text ?? JSON.stringify(interaction.input),
            `input ${interaction.sourceName.toLowerCase() === "developer" ? "system" : ""}`,
            interaction.createdAt,
            interaction,
            $sectionIOChannel,
          );
        } else {
          addMessage(
            interaction.sourceName,
            `Unrenderable input: ${JSON.stringify(interaction.input)}`,
            `input ${interaction.sourceName.toLowerCase() === "developer" ? "system" : ""} unknown`,
            interaction.createdAt,
            interaction,
            $sectionIOChannel,
          );
        }
      }
      if (interaction.output) {
        if (interaction.output?.text) {
          addMessage(
            interaction.sourceName,
            interaction.output.text ?? JSON.stringify(interaction.output),
            "output",
            interaction.createdAt,
            interaction,
            $sectionIOChannel,
          );
        } else if (interaction.output?.error) {
          addMessage(
            interaction.sourceName,
            interaction.output.error?.message ?? JSON.stringify(interaction.output.error),
            "output error",
            interaction.createdAt,
            interaction,
            $sectionIOChannel,
          );
        } else {
          addMessage(
            interaction.sourceName,
            `Unrenderable output: ${JSON.stringify(interaction.output)}`,
            "output unknown",
            interaction.createdAt,
            interaction,
            $sectionIOChannel,
          );
        }
      }
    });

    // Add the section to messages
    $messages.appendChild($sectionIOChannel);
  });
}

function setInteractionsLoading(isLoading: boolean) {
  const $button = $interactionsSearchBtn;
  setButtonLoading($button, isLoading, "Searching...", "Search");
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

async function apiGetPersonDetails(personId: string): Promise<API_Person> {
  const response = await fetch(`/api/persons/${personId}`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch person details");
  }

  return response.json();
}

function createRadarChart(
  emotions: EmotionContext,
  container: HTMLElement,
  onEmotionUpdate?: (emotions: EmotionContext) => void,
) {
  // Set container dimensions
  const width = 400;
  const height = 400;
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Clear previous content
  container.innerHTML = "";

  // Create SVG with proper dimensions
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${margin.left + innerWidth / 2},${margin.top + innerHeight / 2})`);

  // Data preparation
  const data = Object.entries(emotions).map(([key, value]) => ({
    axis: key,
    value: value,
  }));

  // Scales
  const angleSlice = (Math.PI * 2) / data.length;
  const rScale = d3
    .scaleLinear()
    .range([0, Math.min(innerWidth, innerHeight) / 2])
    .domain([0, 100]);

  // Draw the axes
  const axes = svg.selectAll(".axis").data(data).enter().append("g").attr("class", "axis");

  // Append the lines
  axes
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", (d, i) => rScale(100) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("y2", (d, i) => rScale(100) * Math.sin(angleSlice * i - Math.PI / 2))
    .attr("class", "line")
    .style("stroke", "#4a4a4a")
    .style("stroke-width", "2px");

  // Append the labels
  axes
    .append("text")
    .attr("class", "legend")
    .style("font-size", "12px")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("x", (d, i) => rScale(110) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("y", (d, i) => rScale(110) * Math.sin(angleSlice * i - Math.PI / 2))
    .text((d) => d.axis)
    .style("fill", "#e0e0e0");

  // Draw the path
  const radarLine = d3
    .lineRadial<{ value: number }>()
    .radius((d) => rScale(d.value))
    .angle((d, i) => i * angleSlice);

  // Create the path
  svg
    .append("path")
    .datum(data)
    .attr("class", "radarArea")
    .attr("d", radarLine)
    .style("fill", "#ff0000")
    .style("fill-opacity", 0.5)
    .style("stroke", "#4a4a4a")
    .style("stroke-width", "1px");

  // Add interactive dots
  const dots = svg
    .selectAll(".radar-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "radar-dot")
    .attr("r", 8)
    .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
    .style("fill", "#fff")
    .style("stroke", "#4a4a4a")
    .style("stroke-width", "1px")
    .style("cursor", "pointer");

  // Add drag behavior
  const drag = d3
    .drag<SVGCircleElement, { value: number; axis: string }>()
    .on("start", function () {
      d3.select(this).classed("dragging", true);
    })
    .on("drag", function (event, d) {
      const [x, y] = d3.pointer(event, svg.node());
      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = rScale(100);

      // Find the index of the dragged dot in the data array
      const index = data.findIndex((item) => item.axis === d.axis);

      if (index !== -1) {
        // Calculate new value based on distance from center
        const newValue = Math.min(100, Math.max(0, (distance / maxDistance) * 100));

        // Update the data array
        data[index].value = newValue;

        // Update the visualization
        updateRadarChart(data, svg, rScale, angleSlice);

        // Update the emotions object and trigger callback
        if (onEmotionUpdate) {
          const updatedEmotions = data.reduce((acc, { axis, value }) => {
            acc[axis as keyof EmotionContext] = value;
            return acc;
          }, {} as EmotionContext);
          onEmotionUpdate(updatedEmotions);
        }
      }
    })
    .on("end", function () {
      d3.select(this).classed("dragging", false);
    });

  // Apply drag behavior to dots
  dots.call(drag);

  // Store the scales and angle slice for updates
  (dots as any).rScale = rScale;
  (dots as any).angleSlice = angleSlice;
}

function updateRadarChart(
  data: { value: number; axis: string }[],
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  rScale: d3.ScaleLinear<number, number>,
  angleSlice: number,
) {
  // Update the path
  const radarLine = d3
    .lineRadial<{ value: number }>()
    .radius((d) => rScale(d.value))
    .angle((d, i) => i * angleSlice);

  svg.select(".radarArea").datum(data).attr("d", radarLine);

  // Update the dots
  svg
    .selectAll(".radar-dot")
    .data(data)
    .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2));
}

function displayPersonDetails(person: API_Person) {
  const details: DetailField[] = [
    { label: "ID", value: person.id, editable: false },
    { label: "Name", value: person.name, editable: true },
    { label: "Language", value: person.language || "", editable: true },
  ];

  const onSubmit = async (formData: FormData) => {
    const updates = {
      name: formData.get("name"),
      language: formData.get("language"),
      emotions: person.emotions, // Include the current emotions in the update
    };

    const response = await fetch(`/api/persons/${person.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-auth-person": localStorage.getItem("auth"),
      },
      body: JSON.stringify(updates),
    });

    const json = await response.json();

    if (json.error) {
      throw new Error(json.error.message || "Failed to update person");
    }
    addApiStatus($personDetailsContainer, "Person updated successfully", "success");
  };

  const $card = createDetailsCard(details, onSubmit);
  const $form = $card.querySelector("form") as HTMLFormElement;

  // Create radar chart container with proper styling
  const $radarChartContainer = document.createElement("div");
  $radarChartContainer.className = "radar-chart-container mb-3";
  $radarChartContainer.style.width = "100%";
  $radarChartContainer.style.height = "400px";
  $radarChartContainer.style.display = "flex";
  $radarChartContainer.style.justifyContent = "center";
  $radarChartContainer.style.alignItems = "center";

  // Create and append the radar chart with emotion update callback
  createRadarChart(person.emotions, $radarChartContainer, (updatedEmotions) => {
    person.emotions = updatedEmotions;
  });

  // Insert the radar chart before the edit button
  const $editButton = $form.querySelector("button[type='submit']");
  $form.insertBefore($radarChartContainer, $editButton);

  $personDetailsContainer.innerHTML = "";
  $personDetailsContainer.appendChild($card);
}

function bindEventsPersonDetails() {
  $peopleSelect.addEventListener("change", async () => {
    const personId = $peopleSelect.value;
    const $apiStatusContainer = $peopleSelect.closest(".card-body") as HTMLDivElement;

    if (!personId) {
      $personDetailsContainer.innerHTML = "";
      return;
    }

    try {
      clearApiStatus($apiStatusContainer);
      const person = await apiGetPersonDetails(personId);
      displayPersonDetails(person);
    } catch (error) {
      addApiStatus($apiStatusContainer, `Error: ${(error as Error).message}`, "error");
    }
  });
}

async function apiGetIOChannelDetails(channelId: string): Promise<API_IOChannel> {
  const response = await fetch(`/api/io_channels/${channelId}`, {
    headers: {
      "x-auth-person": localStorage.getItem("auth"),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch IO Channel details");
  }

  return response.json();
}

function displayIOChannelDetails(channel: API_IOChannel) {
  const details: DetailField[] = [
    { label: "ID", value: channel.id, editable: false },
    { label: "Name", value: channel.name, editable: false },
    { label: "Owner Name", value: channel.ownerName, editable: false },
    { label: "IO Driver", value: channel.ioDriver, editable: false },
    { label: "IO Identifier", value: channel.ioIdentifier, editable: false },
    { label: "IO Data", value: JSON.stringify(channel.ioData), wrapper: "code" },
    { label: "Person", value: channel.person?.name ?? "Not set", editable: false },
    {
      label: "People",
      value: channel.people.length > 0 ? channel.people.map((p) => p.name).join(", ") : "Not set",
      editable: false,
    },
  ];

  const onSubmit = async (formData: FormData) => {
    const updates = {
      name: formData.get("name"),
    };

    const response = await fetch(`/api/io_channels/${channel.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-auth-person": localStorage.getItem("auth"),
      },
      body: JSON.stringify(updates),
    });

    const json = await response.json();

    if (json.error) {
      throw new Error(json.error.message || "Failed to update IO Channel");
    }
    addApiStatus($ioChannelDetailsContainer, "IO Channel updated successfully", "success");
  };

  const $card = createDetailsCard(details, onSubmit);
  $ioChannelDetailsContainer.innerHTML = "";
  $ioChannelDetailsContainer.appendChild($card);
}

function bindEventsIOChannelDetails() {
  $ioChannelsSelect.addEventListener("change", async () => {
    const channelId = $ioChannelsSelect.value;
    const $apiStatusContainer = $ioChannelsSelect.closest(".card-body") as HTMLDivElement;

    if (!channelId) {
      $ioChannelDetailsContainer.innerHTML = "";
      return;
    }

    try {
      clearApiStatus($apiStatusContainer);
      const channel = await apiGetIOChannelDetails(channelId);
      displayIOChannelDetails(channel);
    } catch (error) {
      addApiStatus($apiStatusContainer, `Error: ${(error as Error).message}`, "error");
    }
  });
}

// Add this function to fetch and display the scheduler map
async function fetchAndDisplaySchedulerMap() {
  try {
    const response = await fetch("/api/admin/input_to_close_friends_scheduler_map", {
      headers: {
        "x-auth-person": localStorage.getItem("auth"),
      },
    });

    const json = await response.json();

    if (json.error) {
      addApiStatus($schedulerMapTable.closest(".card-body") as HTMLDivElement, json.error.message, "error");
      return;
    }

    const data = json.data as API_InputToCloseFriend[];

    // Clear existing rows
    $schedulerMapTable.innerHTML = "";

    // Add new rows
    data.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.person.name}</td>
        <td>${item.ioChannel.name}</td>
        <td>${item.time}</td>
        <td>${item.score}</td>
      `;
      $schedulerMapTable.appendChild(row);
    });

    // If no data, show a message
    if (data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="3" class="text-center">No scheduled inputs for today</td>
      `;
      $schedulerMapTable.appendChild(row);
    }
  } catch (err) {
    addApiStatus($schedulerMapTable.closest(".card-body") as HTMLDivElement, (err as Error).message, "error");
  }
}

async function fetchAndDisplayEpisodicTodo() {
  try {
    const response = await fetch("/api/admin/memory_episodic_todo", {
      headers: {
        "x-auth-person": localStorage.getItem("auth"),
      },
    });

    const json = await response.json();

    if (json.error) {
      addApiStatus($episodicTodoTable.closest(".card-body") as HTMLDivElement, json.error.message, "error");
      return;
    }

    const data = json.data as API_EpisodicMemoryTodo[];

    // Clear existing rows
    $episodicTodoTable.innerHTML = "";

    // Add new rows
    data.forEach((item) => {
      item.payloads.forEach((payload) => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${item.ioChannel.name}</td>
        <td>${item.dateChunk}</td>
        <td>${payload.text}</td>
      `;
        $episodicTodoTable.appendChild(row);
      });
    });

    // If no data, show a message
    if (data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="3" class="text-center">No episodic memory todo items</td>
      `;
      $episodicTodoTable.appendChild(row);
    }
  } catch (err) {
    addApiStatus($episodicTodoTable.closest(".card-body") as HTMLDivElement, (err as Error).message, "error");
  }
}

function bindEventsEpisodicTodo() {
  $episodicTodoRefresh.addEventListener("click", async () => {
    try {
      setButtonLoading($episodicTodoRefresh, true, "Refreshing...", "Refresh");
      await fetchAndDisplayEpisodicTodo();
    } catch (error) {
      addApiStatus($episodicTodoTable.closest(".card-body") as HTMLDivElement, (error as Error).message, "error");
    } finally {
      setButtonLoading($episodicTodoRefresh, false, "Refreshing...", "Refresh");
    }
  });
}

export function bindEvents() {
  $inputAuth.value = localStorage.getItem("auth") || "";
  $inputAuth.addEventListener("change", () => {
    localStorage.setItem("auth", $inputAuth.value);
  });

  bindEventsSelects();
  bindEventsBrainReload();
  bindEventsProcessQueue();
  bindEventsInputMessage();
  bindEventsOutputMessage();
  bindEventsPersonApprove();
  bindEventsPersonDetails();
  bindEventsIOChannelDetails();
  bindEventsMemorySearch();
  bindEventsInteractions();
  bindEventsEpisodicTodo();
  fetchAndDisplaySchedulerMap();
}

bindEvents();
