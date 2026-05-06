const AI_PROXY_URL = "http://localhost:8787/api/summarize";
const CACHE_PREFIX = "summary:";
const MAX_CONTENT_WORDS = 3200;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));

  return true;
});

async function handleMessage(message) {
  if (message?.type && message?.extensionId && message.extensionId !== chrome.runtime.id) {
    throw new Error("Invalid extension message source.");
  }

  if (!message || typeof message.type !== "string") {
    throw new Error("Invalid extension message.");
  }

  if (message.type === "SUMMARIZE_ACTIVE_PAGE") {
    return summarizeActivePage(message.payload);
  }

  if (message.type === "GET_CACHED_SUMMARY") {
    return getCachedSummary(message.payload?.url);
  }

  if (message.type === "CLEAR_SUMMARY_CACHE") {
    await clearCachedSummary(message.payload?.url);
    return { cleared: true };
  }

  throw new Error("Unsupported extension message.");
}

async function summarizeActivePage(payload = {}) {
  const tabId = Number(payload.tabId);
  const url = sanitizeUrl(payload.url);
  const options = sanitizeOptions(payload.options);

  if (!Number.isInteger(tabId)) {
    throw new Error("Could not identify the active tab.");
  }

  if (!url) {
    throw new Error("This page cannot be summarized.");
  }

  const cacheKey = createCacheKey(url, options.length);
  const cached = await readStorage(cacheKey);
  if (cached) {
    if (options.highlight) {
      const phrases = Array.isArray(cached.highlightPhrases) && cached.highlightPhrases.length
        ? cached.highlightPhrases
        : cached.insights;
      await sendHighlightMessage(tabId, phrases);
    }

    return { ...cached, cached: true };
  }

  const extraction = await extractFromTab(tabId);
  if (!extraction?.text || extraction.wordCount < 80) {
    throw new Error("Not enough readable text was found on this page.");
  }

  const summary = await requestSummary({
    title: extraction.title,
    url,
    text: limitWords(extraction.text, MAX_CONTENT_WORDS),
    options
  });

  const data = {
    title: extraction.title,
    url,
    summary: ensureStringArray(summary.summary, 6),
    insights: ensureStringArray(summary.insights, 5),
    highlightPhrases: ensureStringArray(summary.highlightPhrases, 5),
    readingTimeMinutes: extraction.readingTimeMinutes,
    wordCount: extraction.wordCount,
    createdAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ [cacheKey]: data });

  if (options.highlight) {
    await sendHighlightMessage(tabId, data.highlightPhrases.length ? data.highlightPhrases : data.insights);
  }

  return { ...data, cached: false };
}

async function requestSummary(payload) {
  const response = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let body;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error || "The AI summarizer service returned an error.");
  }

  if (!body?.summary || !Array.isArray(body.summary)) {
    throw new Error("The AI summarizer returned an unexpected response.");
  }

  return body;
}

async function extractFromTab(tabId) {
  try {
    return await sendTabMessage(tabId, { type: "EXTRACT_PAGE_CONTENT" });
  } catch (error) {
    if (!error?.message?.includes("Could not establish connection")) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content-script.js"]
    });

    return sendTabMessage(tabId, { type: "EXTRACT_PAGE_CONTENT" });
  }
}

async function getCachedSummary(url) {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) {
    return null;
  }

  const keys = ["short", "medium", "detailed"].map((length) => createCacheKey(safeUrl, length));
  const stored = await chrome.storage.local.get(keys);
  return stored[keys[1]] || stored[keys[0]] || stored[keys[2]] || null;
}

async function clearCachedSummary(url) {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) {
    return;
  }

  const keys = ["short", "medium", "detailed"].map((length) => createCacheKey(safeUrl, length));
  await chrome.storage.local.remove(keys);
}

async function sendHighlightMessage(tabId, insights) {
  try {
    await sendTabMessage(tabId, {
      type: "HIGHLIGHT_KEY_POINTS",
      payload: { phrases: insights }
    });
  } catch (error) {
    // summary delivery should not fail when a page blocks it.
  }
}

async function sendTabMessage(tabId, message) {
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (!response?.ok) {
    throw new Error(response?.error || "Could not communicate with this page.");
  }

  return response.data;
}

function createCacheKey(url, length) {
  return `${CACHE_PREFIX}${length}:${url}`;
}

async function readStorage(key) {
  const stored = await chrome.storage.local.get(key);
  return stored[key] || null;
}

function sanitizeOptions(options = {}) {
  const allowedLengths = new Set(["short", "medium", "detailed"]);

  return {
    length: allowedLengths.has(options.length) ? options.length : "medium",
    highlight: Boolean(options.highlight)
  };
}

function sanitizeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.href;
  } catch (error) {
    return "";
  }
}

function limitWords(text, maxWords) {
  return text.split(/\s+/).slice(0, maxWords).join(" ");
}

function ensureStringArray(value, maxItems) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function getErrorMessage(error) {
  if (error?.message?.includes("Could not establish connection")) {
    return "This page cannot be reached by the extension. Try a normal article page.";
  }

  if (error?.message?.includes("Failed to fetch")) {
    return "Could not reach the local AI proxy. Start the server and try again.";
  }

  return error?.message || "Unexpected extension error.";
}
