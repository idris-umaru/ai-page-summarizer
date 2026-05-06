# Project Plan

## Assignment Breakdown

The project is a local Chrome Extension using Manifest V3.

The extension needs four main pieces:

- Manifest configuration
- Popup interface
- Content script
- Background service worker

An optional backend/proxy can be added to keep AI API keys out of extension code.

## Milestones

- [x] Create Manifest V3 configuration.
- [x] Register popup UI.
- [x] Register background service worker.
- [x] Register content script.
- [x] Build accessible popup layout.
- [x] Extract readable content from active tab.
- [x] Filter clutter from extracted page text.
- [x] Add background message validation.
- [x] Add secure AI request path.
- [x] Add fallback content-script injection for eligible active tabs.
- [x] Add error handling for blocked pages, empty content, and API failure.
- [x] Cache summaries by URL with `chrome.storage`.
- [x] Add clear/reset behavior.
- [x] Add copy summary action.
- [x] Add optional key-point highlighting.
- [ ] Test as unpacked extension in Chrome.
- [ ] Record short demo video.

## Acceptance Criteria Checklist

- [ ] Installs through `chrome://extensions` as an unpacked extension.
- [x] Uses Manifest V3.
- [x] Extracts useful content from article pages.
- [x] Avoids obvious navigation/sidebar clutter.
- [x] Generates structured summary output.
- [x] Does not expose API keys in frontend files.
- [x] Uses secure message passing.
- [x] Uses minimal permissions.
- [x] Handles loading, errors, and empty states.
- [x] Has a clean README with setup, architecture, security, and trade-offs.
