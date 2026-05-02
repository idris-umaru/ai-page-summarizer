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

- [ ] Create Manifest V3 configuration.
- [ ] Register popup UI.
- [ ] Register background service worker.
- [ ] Register content script.
- [ ] Build accessible popup layout.
- [ ] Extract readable content from active tab.
- [ ] Filter clutter from extracted page text.
- [ ] Add background message validation.
- [ ] Add secure AI request path.
- [ ] Add error handling for blocked pages, empty content, and API failure.
- [ ] Cache summaries by URL with `chrome.storage`.
- [ ] Add clear/reset behavior.
- [ ] Add copy summary action.
- [ ] Add optional key-point highlighting.
- [ ] Test as unpacked extension in Chrome.
- [ ] Record short demo video.

## Acceptance Criteria Checklist

- [ ] Installs through `chrome://extensions` as an unpacked extension.
- [ ] Uses Manifest V3.
- [ ] Extracts useful content from article pages.
- [ ] Avoids obvious navigation/sidebar clutter.
- [ ] Generates structured summary output.
- [ ] Does not expose API keys in frontend files.
- [ ] Uses secure message passing.
- [ ] Uses minimal permissions.
- [ ] Handles loading, errors, and empty states.
- [ ] Has a clean README with setup, architecture, security, and trade-offs.

