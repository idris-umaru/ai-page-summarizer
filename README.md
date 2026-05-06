# AI Page Summarizer

A Manifest V3 Chrome extension that extracts readable content from the active page, sends it to a local Gemini proxy, and displays a structured AI summary in the popup.

The extension is designed for local development and demo use. It keeps AI credentials out of browser extension code by routing model requests through a small Node.js server.

## Features

- Extracts readable text from the current `http` or `https` page.
- Prefers article-like content over navigation, sidebars, ads, headers, and footers.
- Generates summary bullets, key insights, reading time, and optional page highlights.
- Supports short, medium, and detailed summary lengths.
- Caches summaries per page URL and summary length with `chrome.storage.local`.
- Handles empty pages, unreachable tabs, missing proxy server, API failures, and cached results.

## Setup Instructions

### 1. Requirements

- Chrome or another Chromium browser that supports Manifest V3 extensions.
- Node.js 18 or newer.
- A Gemini API key from Google AI Studio.


### 3. Start the local AI proxy

This project currently uses only Node.js built-in modules, so no package install step is required.

```powershell
npm start
```

The proxy runs at:

```text
http://localhost:8787
```

You can verify it is alive by opening:

```text
http://localhost:8787/health
```

### 4. Load the Chrome extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension` folder in this repository.
6. Pin the extension.
7. Open a normal article page and click `Summarize Page`.

The proxy must be running before the extension can generate a new summary. Cached summaries can still be shown without another AI request.

## Architecture Explanation

```text
extension/
  manifest.json                    # Manifest V3 config, permissions, host access
  background/service-worker.js      # message routing, cache, content injection, proxy calls
  content/content-script.js         # page extraction and optional highlighting
  popup/popup.html                  # popup markup
  popup/popup.js                    # popup state, settings, rendering, copy/clear actions
  styles/popup.css                  # popup styling

server/
  server.js                         # local Gemini proxy and request validation

docs/
  PROJECT_PLAN.md                   # milestone checklist
  SECURITY.md                       # security notes and threat model
```

The popup is the user-facing controller. It reads the active tab, loads saved settings, checks for cached summaries, and sends summary requests to the background service worker.

The background service worker owns privileged extension work. It validates extension messages, checks `chrome.storage.local`, injects or contacts the content script, limits extracted content to 3,200 words, calls the local proxy, stores successful summaries, and sends optional highlight instructions back to the page.

The content script runs on eligible `http` and `https` pages. It scores article-like containers, extracts headings, paragraphs, list items, and blockquotes, filters noisy sections, estimates reading time, and can wrap short supporting phrases in `<mark>` elements for highlighting.

The local Node server is the AI boundary. It loads `.env`, validates incoming JSON, enforces a maximum request body size, calls Gemini, normalizes the model response, and returns only summary data to the extension.

## Message Flow

```text
Popup
  -> requests a summary for the active tab

Background service worker
  -> validates the message
  -> checks chrome.storage.local for a cached summary
  -> asks the content script to extract readable page text
  -> injects the content script if Chrome has not connected it yet
  -> sends title, URL, text, and options to the local proxy
  -> stores the normalized summary in chrome.storage.local
  -> optionally asks the content script to highlight supporting phrases
  -> returns summary data to the popup

Local proxy
  -> validates and trims input
  -> calls the configured Gemini model
  -> falls back to configured fallback models for capacity errors
  -> returns strict JSON summary data
```

## AI Integration Explanation

The extension does not call Gemini directly. Browser extension files are visible to users, so putting an API key in `popup.js`, `content-script.js`, `service-worker.js`, or `manifest.json` would expose the credential.

Instead, `extension/background/service-worker.js` sends a POST request to:

```text
http://localhost:8787/api/summarize
```

The request contains:

- page title
- page URL
- extracted page text
- summary length option
- highlight preference

`server/server.js` then calls Gemini through the `generateContent` endpoint. It uses a system instruction that asks the model to return strict JSON with these keys:

- `summary`
- `insights`
- `highlightPhrases`

The server parses the JSON, cleans each string, limits array lengths, and returns normalized data. The background worker adds local metadata such as word count, reading time, source URL, creation time, and cache status.

The default model is `gemini-2.5-flash-lite`. Additional fallback models can be configured with `GEMINI_FALLBACK_MODELS`; the server retries fallback models for capacity-related failures such as `429`, `503`, or high-demand responses.

## Security Decisions

- API keys live only in server-side environment variables.
- `.env` is ignored by git, and `.env.example` contains placeholders only.
- Extension code calls a local proxy instead of a public AI API directly.
- The extension requests a narrow permission set: `activeTab`, `scripting`, `storage`, and `http://localhost:8787/*`.
- Page access is limited to normal `http` and `https` pages.
- The background service worker validates message shape and extension source before acting.
- URLs are sanitized so only `http` and `https` pages are summarized.
- The proxy validates request payloads and rejects missing titles, invalid URLs, very short text, invalid JSON, and oversized request bodies.
- Extracted text is truncated before being sent to the model.
- Popup rendering uses DOM text assignment rather than injecting model output as HTML.
- The local proxy only returns CORS headers for Chrome extension origins and localhost development origins.
- Cached data is limited to summary output and metadata needed by the extension experience.

Users should avoid summarizing pages that contain passwords, private account details, financial records, medical records, confidential work data, or sensitive personal information. The extracted page text is sent to the configured AI provider through the local proxy.

## Trade-Offs

- The project uses vanilla JavaScript and no build step, which makes local extension loading simple but gives up TypeScript checks, bundling, and richer dependency management.
- The local proxy keeps secrets out of the extension, but the user must run `npm start` before new summaries can be generated.
- Content extraction uses lightweight heuristics instead of Mozilla Readability or a similar parser. This keeps the extension dependency-free, but some complex pages may extract too much or too little text.
- Summaries are cached by URL and selected length. This improves speed and reduces API usage, but page updates at the same URL may require clearing the cached summary.
- Only the first 3,200 extracted words are sent to the proxy. This controls cost and latency, but very long articles may lose late-page details.
- Highlighting uses short phrase matching in page text. It is useful as a lightweight visual aid, but it can miss phrases when the page text is split across nodes or transformed by the site.
- The proxy is intended for local use. A production deployment would need authentication, rate limiting, HTTPS, logging controls, abuse protection, and a more explicit data retention policy.

## Current Status

Implemented:

- Manifest V3 extension setup.
- Popup UI with loading, clear, copy, summary length, cache badge, error state, and saved settings.
- Content script extraction heuristics and optional key point highlighting.
- Background service worker message routing, cache handling, content-script injection, and proxy calls.
- Local Node proxy with Gemini integration, response normalization, model fallback, CORS handling, and request validation.

Potential improvements:

- Add automated tests for extraction, message validation, and proxy payload validation.
- Add extension icons and Chrome Web Store metadata if the project moves beyond local demo use.
- Replace heuristic extraction with a dedicated readability parser.
- Add configurable proxy URL support for non-local environments.
