import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODELS = getFallbackModels();
const MAX_BODY_BYTES = 900000;
const ALLOWED_ORIGIN_PATTERN = /^(chrome-extension:\/\/[a-z]+|http:\/\/localhost(?::\d+)?)$/;

const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/summarize") {
    sendJson(response, 404, { error: "Route not found." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const payload = validatePayload(body);
    const summary = await summarizeWithGemini(payload);
    sendJson(response, 200, summary);
  } catch (error) {
    const status = error.status || 500;
    sendJson(response, status, { error: error.message || "Server error." });
  }
});

server.listen(PORT, () => {
  console.log(`AI Page Summarizer proxy listening on http://localhost:${PORT}`);
});

function setCorsHeaders(request, response) {
  const origin = request.headers.origin || "";
  if (ALLOWED_ORIGIN_PATTERN.test(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }

  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  let raw = "";
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }

    raw += chunk;
  }

  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    const parseError = new Error("Invalid JSON body.");
    parseError.status = 400;
    throw parseError;
  }
}

function validatePayload(body) {
  const title = cleanString(body.title, 250);
  const url = cleanUrl(body.url);
  const text = cleanString(body.text, 24000);
  const length = ["short", "medium", "detailed"].includes(body.options?.length)
    ? body.options.length
    : "medium";

  if (!title) {
    throw badRequest("Page title is required.");
  }

  if (!url) {
    throw badRequest("Valid page URL is required.");
  }

  if (text.split(/\s+/).filter(Boolean).length < 80) {
    throw badRequest("Page text is too short to summarize.");
  }

  return { title, url, text, length };
}

async function summarizeWithGemini(payload) {
  if (!GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not set on the local proxy server.");
    error.status = 500;
    throw error;
  }

  let lastCapacityError;
  for (const model of GEMINI_FALLBACK_MODELS) {
    try {
      return await requestGeminiSummary(model, payload);
    } catch (error) {
      if (!isCapacityError(error)) {
        throw error;
      }

      lastCapacityError = error;
    }
  }

  throw lastCapacityError || new Error("Gemini request failed.");
}

async function requestGeminiSummary(model, payload) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You summarize webpages for a Chrome extension. Return strict JSON with keys summary, insights, and highlightPhrases. Each value must be an array of concise strings. highlightPhrases should contain short verbatim phrases from the page text that support the insights. Do not include markdown."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(payload) }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "Gemini request failed.";
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.error?.status || "";
    throw error;
  }

  const content = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!content) {
    throw new Error("Gemini returned an empty summary.");
  }

  return normalizeAiResponse(content);
}

function getFallbackModels() {
  const configured = String(process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const models = [GEMINI_MODEL, ...configured, "gemini-2.5-flash-lite", "gemini-2.5-flash"];
  return [...new Set(models)];
}

function isCapacityError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 || error?.status === 503 || message.includes("high demand");
}

function buildPrompt({ title, url, text, length }) {
  const summaryCounts = {
    short: "exactly 3",
    medium: "4 to 5",
    detailed: "6 to 7"
  };

  return [
    `Title: ${title}`,
    `URL: ${url}`,
    `Summary length: ${length}`,
    "",
    `Create ${summaryCounts[length]} summary bullets, 3 key insights, and up to 5 short highlight phrases.`,
    "Focus on claims, decisions, evidence, numbers, names, and practical takeaways.",
    "Avoid generic phrases and do not invent details that are not supported by the page text.",
    "",
    "Page text:",
    text
  ].join("\n");
}

function normalizeAiResponse(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("AI response was not valid JSON.");
  }

  return {
    summary: toCleanArray(parsed.summary, 7),
    insights: toCleanArray(parsed.insights, 5),
    highlightPhrases: toCleanArray(parsed.highlightPhrases, 5)
  };
}

function toCleanArray(value, maxItems) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => cleanString(item, 320)).filter(Boolean).slice(0, maxItems);
}

function cleanString(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
