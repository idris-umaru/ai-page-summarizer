const pageTitle = document.querySelector("#pageTitle");
const cacheBadge = document.querySelector("#cacheBadge");
const summaryLength = document.querySelector("#summaryLength");
const highlightToggle = document.querySelector("#highlightToggle");
const summarizeButton = document.querySelector("#summarizeButton");
const summarizeLabel = document.querySelector("#summarizeLabel");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const statusMessage = document.querySelector("#statusMessage");
const errorMessage = document.querySelector("#errorMessage");
const metaPanel = document.querySelector("#metaPanel");
const readingTime = document.querySelector("#readingTime");
const wordCount = document.querySelector("#wordCount");
const summaryPanel = document.querySelector("#summaryPanel");
const summaryList = document.querySelector("#summaryList");
const insightsList = document.querySelector("#insightsList");

let activeTab;
let currentSummaryText = "";

init();

async function init() {
  setStatus("Ready when the page is.");

  try {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    pageTitle.textContent = activeTab?.title || "Untitled page";
    await loadSettings();
    await loadCachedSummary();
  } catch (error) {
    showError("Could not read the active tab.");
  }
}

summarizeButton.addEventListener("click", async () => {
  hideError();
  setLoading(true);
  setStatus("Extracting readable page content...");
  cacheBadge.hidden = true;

  try {
    const result = await chrome.runtime.sendMessage({
      type: "SUMMARIZE_ACTIVE_PAGE",
      payload: {
        tabId: activeTab?.id,
        url: activeTab?.url,
        options: {
          length: summaryLength.value,
          highlight: highlightToggle.checked
        }
      }
    });

    if (!result?.ok) {
      throw new Error(result?.error || "Summary failed.");
    }

    renderSummary(result.data);
    cacheBadge.hidden = !result.data.cached;
    setStatus(result.data.cached ? "Loaded from cache." : "Summary generated.");
  } catch (error) {
    showError(error.message || "Something went wrong while summarizing.");
    setStatus("");
  } finally {
    setLoading(false);
  }
});

copyButton.addEventListener("click", async () => {
  if (!currentSummaryText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentSummaryText);
    setStatus("Summary copied.");
  } catch (error) {
    showError("Could not copy the summary.");
  }
});

clearButton.addEventListener("click", async () => {
  hideError();
  clearSummary();
  cacheBadge.hidden = true;
  setStatus("Cleared.");

  if (activeTab?.url) {
    await chrome.runtime.sendMessage({
      type: "CLEAR_SUMMARY_CACHE",
      payload: { url: activeTab.url }
    });
  }

  if (activeTab?.id) {
    await chrome.tabs.sendMessage(activeTab.id, { type: "CLEAR_HIGHLIGHTS" }).catch(() => null);
  }
});

summaryLength.addEventListener("change", saveSettings);
highlightToggle.addEventListener("change", saveSettings);

async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings) {
    return;
  }

  summaryLength.value = settings.length || "medium";
  highlightToggle.checked = Boolean(settings.highlight);
}

async function saveSettings() {
  await chrome.storage.local.set({
    settings: {
      length: summaryLength.value,
      highlight: highlightToggle.checked
    }
  });
}

async function loadCachedSummary() {
  if (!activeTab?.url) {
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_CACHED_SUMMARY",
    payload: { url: activeTab.url }
  });

  if (response?.ok && response.data) {
    renderSummary({ ...response.data, cached: true });
    cacheBadge.hidden = false;
    setStatus("Cached summary available.");
  }
}

function renderSummary(data) {
  pageTitle.textContent = data.title || activeTab?.title || "Untitled page";
  readingTime.textContent = `${data.readingTimeMinutes || 1} min`;
  wordCount.textContent = Number(data.wordCount || 0).toLocaleString();

  replaceList(summaryList, data.summary || []);
  replaceList(insightsList, data.insights || []);

  metaPanel.hidden = false;
  summaryPanel.hidden = false;
  copyButton.disabled = false;
  currentSummaryText = formatSummaryForCopy(data);
}

function replaceList(list, items) {
  list.replaceChildren();

  const safeItems = items.length ? items : ["No summary text was returned."];
  for (const item of safeItems) {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  }
}

function formatSummaryForCopy(data) {
  const summary = (data.summary || []).map((item) => `- ${item}`).join("\n");
  const insights = (data.insights || []).map((item) => `- ${item}`).join("\n");
  return [
    data.title || "Page summary",
    "",
    `Source: ${data.url || activeTab?.url || "Current page"}`,
    `Estimated reading time: ${data.readingTimeMinutes || 1} min`,
    "",
    "Summary",
    summary,
    "",
    "Key insights",
    insights,
    ""
  ].join("\n");
}

function clearSummary() {
  currentSummaryText = "";
  summaryList.replaceChildren();
  insightsList.replaceChildren();
  metaPanel.hidden = true;
  summaryPanel.hidden = true;
  copyButton.disabled = true;
}

function setLoading(isLoading) {
  summarizeButton.disabled = isLoading;
  summarizeButton.classList.toggle("is-loading", isLoading);
  summarizeLabel.textContent = isLoading ? "Summarizing..." : "Summarize Page";
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function hideError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}
