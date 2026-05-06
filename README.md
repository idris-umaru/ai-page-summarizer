# AI Page Summarizer Chrome Extension

Stage 4A Manifest V3 Chrome Extension that extracts readable page content, sends it to a local Gemini AI proxy, and displays a structured summary in a popup.

## What This Project Is Expected To Do

You are expected to build a real local Chrome Extension, not just a mock UI. When installed in Chrome and clicked, it should:

- Read meaningful content from the active webpage.
- Prefer article/main content over navigation, sidebars, ads, and footer text.
- Send extracted text to an AI summarization flow.
- Show a structured result in the popup:
  - bullet-point summary
  - key insights
  - estimated reading time
- Cache summaries by page URL with `chrome.storage`.
- Handle loading, empty pages, API failures, and repeated requests gracefully.
- Optionally highlight important sections on the current page.

## Important Security Expectation

The extension must not expose API keys in popup JavaScript, content scripts, or committed files.

The safe options are:

- Use a background service worker to call a local/private proxy.
- Use your own backend proxy that stores the API key in server environment variables.
- For local demos only, load secrets from uncommitted environment configuration on the backend side.

Do not hardcode or commit secrets.

## Current Architecture

```text
extension/
  manifest.json                    # Manifest V3 config
  background/service-worker.js      # message routing, cache, content injection, AI proxy calls
  content/content-script.js         # readable text extraction and highlighting
  popup/popup.html                  # popup UI
  popup/popup.js                    # popup behavior
  styles/popup.css                  # popup styling

server/
  server.js                         # local AI proxy

docs/
  PROJECT_PLAN.md        # milestone checklist
  SECURITY.md            # security decisions and threat notes
```

## Message Flow

```text
Popup
  -> asks background service worker to summarize current tab

Background service worker
  -> checks chrome.storage cache
  -> asks content script for readable page content
  -> injects the content script into eligible active tabs if needed
  -> sends content to secure AI endpoint or proxy
  -> stores result in chrome.storage
  -> returns summary to popup

Content script
  -> extracts title, URL, article text, word count
  -> optionally receives highlight instructions
```

## Local Setup

### 1. Configure the Gemini AI proxy

Create a `.env` file in the repo root:

```text
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-2.5-flash
PORT=8787
```

`.env` is ignored by git. Do not commit it.

You can create a Gemini API key in Google AI Studio, then paste it into `.env`.

### 2. Start the local proxy

This project does not require npm packages for the current server.

```powershell
npm start
```

The proxy should start at:

```text
http://localhost:8787
```

### 3. Download or clone this repository

From GitHub, either:

- Click `Code` -> `Download ZIP`, then unzip the project.
- Or clone it with git:

```powershell
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 4. Install the extension locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension` folder from this repository.
6. Pin the extension.
7. Open an article page and click `Summarize Page`.

This extension is intended for local installation only and should not be uploaded to the Chrome Web Store for this assignment.

## Implementation Status

Implemented:

- Manifest V3 extension setup.
- Popup UI with loading, clear, copy, summary length, cache badge, error state, and focus styles.
- Content script with readable page extraction heuristics.
- Background service worker with message validation, summary cache, and proxy calls.
- Optional in-page key point highlighting.
- Local Node proxy that keeps the Gemini API key outside extension code.

Still recommended before final submission:

- Add extension icons.
- Test on several real article pages.
- Record the 2 to 5 minute demo video.
- Optionally improve extraction with Mozilla Readability or another parser.



## Trade-Offs

- The extension uses vanilla JavaScript so Chrome can load it directly without a build step.
- The AI call goes through `localhost:8787`, which keeps the Gemini API key out of the extension but requires the proxy server to be running.
- Content extraction uses heuristics instead of a full readability parser to avoid dependencies in the first working version.
- The extension requests `activeTab`, `scripting`, `storage`, and local proxy host access only.
- The local proxy restricts browser CORS responses to Chrome extension origins and localhost.
