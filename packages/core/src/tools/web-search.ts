import { tool } from "ai";
import { z } from "zod";

interface DDGResult {
  title: string;
  url: string;
  snippet: string;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, ""));
}

function decodeDdgUrl(href: string): string {
  // DuckDuckGo wraps target URLs like /l/?uddg=<encoded>
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

function parseDuckDuckGo(html: string, limit: number): DDGResult[] {
  const results: DDGResult[] = [];
  // Match result blocks
  const resultRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html)) !== null) {
    if (results.length >= limit) break;
    const [, href, titleHtml, snippetHtml] = match;
    results.push({
      title: stripTags(titleHtml).trim(),
      url: decodeDdgUrl(href),
      snippet: stripTags(snippetHtml).trim(),
    });
  }
  return results;
}

export const webSearchTool = tool({
  description:
    "Search the web via DuckDuckGo. Returns top results with title, URL, and snippet. Use for current events, documentation, or unknown facts.",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Max results (default 5)"),
  }),
  execute: async ({ query, limit }) => {
    const max = Math.min(limit ?? 5, 10);
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!res.ok) {
        return `[error] DuckDuckGo returned HTTP ${res.status}`;
      }

      const html = await res.text();
      const results = parseDuckDuckGo(html, max);

      if (results.length === 0) {
        return `No results found for "${query}".`;
      }

      return results
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
        )
        .join("\n\n");
    } catch (e: unknown) {
      const err = e as { message?: string };
      return `[error] Search failed: ${err.message ?? "unknown"}`;
    }
  },
});
