# AI Page Summarizer Chrome Extension

Stage 4A project scaffold for a Manifest V3 Chrome Extension that extracts readable page content, sends it to an AI backend/provider, and displays a structured summary in a popup.

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

## Planned Architecture

```text
extension/
  manifest.json          # Manifest V3 config
  background/            # service worker and AI request coordination
  content/               # page extraction and optional highlighting
  popup/                 # popup HTML/CSS/JS
  styles/                # shared extension styles
  assets/                # icons and images

server/
  # Optional local proxy for secure AI API calls

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
  -> sends content to secure AI endpoint or proxy
  -> stores result in chrome.storage
  -> returns summary to popup

Content script
  -> extracts title, URL, article text, word count
  -> optionally receives highlight instructions
```

## Setup Plan

Implementation has not started yet. This repository currently contains the structure and planning docs only.

Recommended next steps:

1. Add Manifest V3 files.
2. Build popup UI shell.
3. Add content extraction script.
4. Add background message handling.
5. Add secure AI integration through a backend/proxy.
6. Add summary caching with `chrome.storage`.
7. Polish accessibility, error handling, and README demo instructions.

## Local Installation Steps

Once implementation is added:

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension` folder from this repository.
6. Pin the extension and test it on article pages.

This extension is intended for local installation only and should not be uploaded to the Chrome Web Store for this assignment.

## Demo Video Guidance

The submission asks for a short demo video, usually 2 to 5 minutes. Show:

- Loading the unpacked extension.
- Opening an article page.
- Clicking `Summarize Page`.
- Seeing loading, summary, key insights, and reading time.
- Showing cache behavior by summarizing the same page again.
- Briefly explaining that API keys are kept out of frontend extension code.

