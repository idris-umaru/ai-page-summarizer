# Security Notes

## Core Rule

Do not expose API keys in extension frontend code.

Files that must never contain secrets:

- `extension/popup/*`
- `extension/content/*`
- `extension/background/*`
- `manifest.json`
- Any committed config file

## Recommended AI Integration

Use a backend/proxy service for AI requests.

The extension sends extracted page content to the proxy. The proxy owns the real AI API key through environment variables and returns only the summary result.

## Chrome Extension Security Decisions

- Request the smallest permission set needed.
- Use `activeTab` where possible instead of broad host permissions.
- Validate messages received by the background service worker.
- Sanitize text before rendering in the popup.
- Use `textContent` or safe DOM construction instead of injecting raw HTML.
- Cache only summary data needed for the extension experience.

## Data Handling Trade-Offs

The extension sends page text to an AI provider or proxy. This is necessary for summarization but should be explained clearly in the README and demo.

Avoid sending:

- passwords
- private account pages
- financial or medical records
- pages with sensitive personal data

