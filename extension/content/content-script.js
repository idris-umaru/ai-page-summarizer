const HIGHLIGHT_CLASS = "ai-page-summarizer-highlight";
const MAX_TEXT_LENGTH = 18000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "EXTRACT_PAGE_CONTENT") {
    sendResponse({ ok: true, data: extractPageContent() });
    return false;
  }

  if (message.type === "HIGHLIGHT_KEY_POINTS") {
    const phrases = Array.isArray(message.payload?.phrases) ? message.payload.phrases : [];
    const count = highlightKeyPoints(phrases);
    sendResponse({ ok: true, data: { count } });
    return false;
  }

  if (message.type === "CLEAR_HIGHLIGHTS") {
    clearHighlights();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

function extractPageContent() {
  const title = getTitle();
  const url = location.href;
  const root = chooseReadableRoot();
  const text = normalizeText(collectReadableText(root)).slice(0, MAX_TEXT_LENGTH);
  const wordCount = countWords(text);

  return {
    title,
    url,
    text,
    wordCount,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 220)),
    extractedAt: new Date().toISOString()
  };
}

function getTitle() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  return normalizeText(ogTitle || document.title || "Untitled page");
}

function chooseReadableRoot() {
  const candidates = [
    ...document.querySelectorAll(
      "article, main, [role='main'], .article, .post, .entry-content, .post-content, .article-body, .story-body"
    )
  ];

  const scored = candidates
    .map((element) => ({ element, score: scoreElement(element) }))
    .filter((item) => item.score > 300)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.element || document.body;
}

function scoreElement(element) {
  const text = normalizeText(element.innerText || "");
  const paragraphs = element.querySelectorAll("p").length;
  const links = element.querySelectorAll("a").length;
  const linkText = Array.from(element.querySelectorAll("a"))
    .map((link) => link.innerText || "")
    .join(" ");
  const linkDensity = text.length ? normalizeText(linkText).length / text.length : 1;

  return text.length + paragraphs * 120 - links * 15 - linkDensity * 800;
}

function collectReadableText(root) {
  const blockedSelector = [
    "nav",
    "aside",
    "footer",
    "header",
    "form",
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "[aria-hidden='true']",
    ".nav",
    ".navbar",
    ".sidebar",
    ".footer",
    ".header",
    ".menu",
    ".advertisement",
    ".ads",
    ".social",
    ".share",
    ".comments"
  ].join(",");

  const pieces = [];
  const nodes = root.querySelectorAll("h1, h2, h3, p, li, blockquote");

  for (const node of nodes) {
    if (node.closest(blockedSelector)) {
      continue;
    }

    const text = normalizeText(node.innerText || node.textContent || "");
    if (text.length < 35 && !/^h[1-3]$/i.test(node.tagName)) {
      continue;
    }

    const linkText = Array.from(node.querySelectorAll("a"))
      .map((link) => link.innerText || "")
      .join(" ");
    const linkDensity = text.length ? normalizeText(linkText).length / text.length : 0;
    if (linkDensity > 0.55) {
      continue;
    }

    pieces.push(text);
  }

  if (pieces.join(" ").length < 500) {
    return normalizeText(root.innerText || document.body.innerText || "");
  }

  return pieces.join("\n\n");
}

function highlightKeyPoints(phrases) {
  clearHighlights();
  ensureHighlightStyles();

  const safePhrases = phrases
    .map((phrase) => normalizeText(String(phrase || "")))
    .filter((phrase) => phrase.length >= 24)
    .slice(0, 5);

  if (!safePhrases.length) {
    return 0;
  }

  let count = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, noscript, textarea, input, select, mark")) {
        return NodeFilter.FILTER_REJECT;
      }

      const text = normalizeText(node.nodeValue || "").toLowerCase();
      return safePhrases.some((phrase) => text.includes(phrase.slice(0, 80).toLowerCase()))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    }
  });

  const matches = [];
  while (walker.nextNode() && matches.length < 5) {
    matches.push(walker.currentNode);
  }

  for (const node of matches) {
    const text = node.nodeValue || "";
    const normalizedText = normalizeText(text).toLowerCase();
    const phrase = safePhrases.find((item) => normalizedText.includes(item.slice(0, 80).toLowerCase()));
    if (!phrase) {
      continue;
    }

    const snippet = phrase.slice(0, 50).toLowerCase();
    const index = text.toLowerCase().indexOf(snippet);
    if (index < 0) {
      continue;
    }

    try {
      const range = document.createRange();
      range.setStart(node, Math.min(index, text.length));
      range.setEnd(node, Math.min(index + snippet.length, text.length));

      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_CLASS;
      range.surroundContents(mark);
      count += 1;
    } catch (error) {
      // Skip nodes that cannot be safely wrapped.
    }
  }

  return count;
}

function ensureHighlightStyles() {
  if (document.getElementById("ai-page-summarizer-highlight-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ai-page-summarizer-highlight-styles";
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background: #fff2a8 !important;
      color: inherit !important;
      border-radius: 3px !important;
      box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.35) !important;
      padding: 0 2px !important;
    }
  `;
  document.documentElement.append(style);
}

function clearHighlights() {
  const marks = document.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`);
  for (const mark of marks) {
    mark.replaceWith(document.createTextNode(mark.textContent || ""));
  }
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}
