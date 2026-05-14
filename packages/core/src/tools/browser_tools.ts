import { Tool } from "../types.js";

let currentUrl = "";
let currentSnapshot = "";
let history: Array<{ url: string; content: string }> = [];

async function navigateTo(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return `Navigation failed: HTTP ${res.status}`;
    const html = await res.text();

    currentUrl = url;
    history.push({ url, content: html });

    // Clean up HTML for text snapshot
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    // Extract title
    const titleMatch = cleaned.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "No title";

    // Extract links
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
    const links: Array<{ text: string; href: string }> = [];
    let match;
    while ((match = linkRegex.exec(cleaned)) !== null) {
      const text = match[2].replace(/<[^>]+>/g, "").trim();
      if (text) links.push({ text, href: match[1] });
    }

    // Extract body text
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyText = (bodyMatch ? bodyMatch[1] : cleaned)
      .replace(/<\/p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li>/gi, "\n- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 10000);

    currentSnapshot = bodyText;

    const linkList = links.slice(0, 20).map((l, i) => `[${i}] ${l.text} -> ${l.href}`).join("\n");
    return `Navigated to: ${url}\nTitle: ${title}\n\n${bodyText}\n\nLinks: ${linkList ? linkList : "(none found)"}`;
  } catch (e) {
    return `Navigation failed: ${(e as Error).message}`;
  }
}

function snapshot(): string {
  if (!currentUrl) return "No page loaded. Use browser_navigate first.";
  return `Current URL: ${currentUrl}\n\nPage content:\n${currentSnapshot}`;
}

async function clickElement(selectorOrText: string): Promise<string> {
  if (!currentUrl) return "No page loaded. Use browser_navigate first.";
  return `[Mock browser] Clicking element matching "${selectorOrText}" on ${currentUrl}. In production, this would use Puppeteer/Playwright for real browser automation.`;
}

async function fillField(selector: string, value: string): Promise<string> {
  if (!currentUrl) return "No page loaded. Use browser_navigate first.";
  return `[Mock browser] Filling field "${selector}" with value on ${currentUrl}. In production, this would use Puppeteer/Playwright for real browser automation.`;
}

function vision(): string {
  if (!currentUrl) return "No page loaded. Use browser_navigate first.";
  return `[Mock browser] Visual analysis of ${currentUrl}. In production, this would capture a screenshot and use a vision-capable model to analyze it.`;
}

export const browserTools: Tool[] = [
  {
    name: "browser_navigate",
    description: "Navigate to a URL and get a text snapshot of the page",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
      },
      required: ["url"],
    },
    handler: async (args) => navigateTo(args.url as string),
    toolset: "browser",
  },
  {
    name: "browser_snapshot",
    description: "Get a text snapshot of the current page content",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => snapshot(),
    toolset: "browser",
  },
  {
    name: "browser_click",
    description: "Click an element on the current page by selector or text",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector or text content to match" },
      },
      required: ["selector"],
    },
    handler: async (args) => clickElement(args.selector as string),
    toolset: "browser",
  },
  {
    name: "browser_fill",
    description: "Fill an input field on the current page",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the input field" },
        value: { type: "string", description: "The value to fill" },
      },
      required: ["selector", "value"],
    },
    handler: async (args) => fillField(args.selector as string, args.value as string),
    toolset: "browser",
  },
  {
    name: "browser_vision",
    description: "Visually analyze the current page (uses vision-capable model)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => vision(),
    toolset: "browser",
  },
];
