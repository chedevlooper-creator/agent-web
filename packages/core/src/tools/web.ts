import { Tool } from "../types.js";

async function duckDuckGoSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Parse results
    const results: Array<{ title: string; snippet: string; url: string }> = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

    let m;
    const titles: Array<{ url: string; title: string }> = [];
    while ((m = resultRegex.exec(html)) !== null) {
      let href = m[1];
      if (href.startsWith("//")) href = "https:" + href;
      let title = m[2].replace(/<[^>]+>/g, "").trim();
      titles.push({ url: href, title });
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]+>/g, "").trim());
    }

    for (let i = 0; i < Math.min(titles.length, snippets.length, 8); i++) {
      results.push({
        title: titles[i].title,
        url: titles[i].url,
        snippet: snippets[i],
      });
    }

    if (results.length === 0) {
      // Fallback: extract any links and text
      return "No structured results found. Try a different query or use web_scrape on a known URL.";
    }

    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
      .join("\n\n");
  } catch (e) {
    return `Search failed: ${(e as Error).message}`;
  }
}

async function scrapeUrl(targetUrl: string): Promise<string> {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Simple extraction: remove scripts/styles, then extract text
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

    // Extract title
    const titleMatch = cleaned.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "No title";

    // Extract body text
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : cleaned;

    // Convert remaining tags to newlines
    let text = body
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li>/gi, "\n- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Limit length
    if (text.length > 15000) {
      text = text.slice(0, 15000) + "\n\n[Content truncated]";
    }

    return `Title: ${title}\nURL: ${targetUrl}\n\n${text}`;
  } catch (e) {
    return `Scrape failed: ${(e as Error).message}`;
  }
}

export const webTools: Tool[] = [
  {
    name: "web_search",
    description: "Search the web using DuckDuckGo for a query. Returns top results with title, URL, and snippet.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      return await duckDuckGoSearch(args.query as string);
    },
    toolset: "web",
  },
  {
    name: "web_scrape",
    description: "Fetch and extract readable text from a web page URL",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to scrape" },
      },
      required: ["url"],
    },
    handler: async (args) => {
      return await scrapeUrl(args.url as string);
    },
    toolset: "web",
  },
];
